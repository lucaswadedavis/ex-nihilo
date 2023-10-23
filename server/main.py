import json
import os
import sqlite3

import dataset
import openai
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

DATABASE = 'nihilo.db'

db = dataset.connect('sqlite:///nihilo.db')
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def create_sql_system_prompt():
    system_prompt = '''
    You are a narrow AI assistant that helps people with their data.
    User Input comes in as JSON and you create SQL queries to execute against the database.
    The database is SQLite.

    The tables and schemas are as follows:

  '''
    tables = db.query(
        "SELECT name, sql FROM sqlite_master WHERE type='table';")
    for table in tables:
        name, sql = table['name'], table['sql']
        table_schema = sql.replace('\n', '').replace('  ', ' ')
        system_prompt += f"**Table Name:** {name}\n **Schema:** {table_schema}\n\n"
    system_prompt += "\n\n"
    system_prompt += "If a table doesn't yet exist to store the data, you are allowed to create it.\n"
    system_prompt += "Make sure when adding records that they all have ids.\n"
    system_prompt += "If a record already exists, you are allowed to update it.\n"
    system_prompt += "If a record doesn't exist, you are allowed to create it.\n"
    system_prompt += "If asked about content of the database, only respond with data actually in the database.\n"
    system_prompt += "When creating a new table, always create a primary key called 'id' that is an integer.\n"
    system_prompt += "When creating a new table, always create a column called 'created_at' that is a timestamp.\n"
    system_prompt += "When creating a new table, always create a column called 'updated_at' that is a timestamp.\n"
    system_prompt += "When adding new records, make sure to only add fields that are in the schema.\n"
    system_prompt += "When updating records, make sure to only update fields that are in the schema.\n"
    system_prompt += "When creating records, if the schema includes a column for last update, or created be sure to update it\n"
    system_prompt += "The response to the user will be created based on the result of the final SQL query.\n"
    system_prompt += "IF ADDING A ROW TO AN EXISTING TABLE:\n"
    system_prompt += "Begin by writing a comment that describes the schema of the table.\n"
    system_prompt += "And always write to as many fields as possible.\n"
    return system_prompt


def create_dispatch_component_system_prompt(user_input, queries, records):
    component_system_prompt = 'You are a helpful database AI.\n'
    component_system_prompt += 'You were given the following user input:\n'
    component_system_prompt += user_input
    component_system_prompt += '\n\n'
    component_system_prompt += 'The following SQL queries were executed:\n'
    component_system_prompt += '\n'.join(queries)
    component_system_prompt += '\n\n'
    component_system_prompt += 'The following records were returned:\n'
    for record in records:
        for key, value in record.items():
            component_system_prompt += f'{key}: {value}\n'
        component_system_prompt += '\n'
    component_system_prompt += '\n\n'
    component_system_prompt += 'Your job is to choose a display component to render the data\n'
    component_system_prompt += 'You can choose from the following:\n'
    for func in component_functions:
        component_system_prompt += f'{func["name"]}: {func["description"]}\n'
    # component_system_prompt += 'If you are unsure, choose the markdown component:\n'
    return component_system_prompt


def create_component_system_prompt(user_input, queries, records, component_name):
    valid_component_names = {func['name'] for func in component_functions}
    if component_name not in valid_component_names:
        component_name = 'markdown_component'
    component = [
        func for func in component_functions if func['name'] == component_name]
    component = component[0]
    component_system_prompt = 'You are a helpful database AI.\n'
    component_system_prompt += 'You were given the following user input:\n'
    component_system_prompt += user_input
    component_system_prompt += '\n\n'
    component_system_prompt += 'The following SQL queries were executed:\n'
    component_system_prompt += '\n'.join(queries)
    component_system_prompt += '\n\n'
    component_system_prompt += 'The following records were returned:\n'
    for record in records:
        for key, value in record.items():
            component_system_prompt += f'{key}: {value}\n'
        component_system_prompt += '\n'
    component_system_prompt += '\n\n'
    component_system_prompt += 'Your job is to create data for the component to render.\n'
    component_system_prompt += 'The schema for the data is as follows:\n\n'
    component_system_prompt += json.dumps(component['parameters'], indent=4)
    component_system_prompt += '\n\n'
    if 'instruction' in component:
        component_system_prompt += component['instruction']
        component_system_prompt += '\n\n'
    return component_system_prompt


create_first_tables = '''
            CREATE TABLE IF NOT EXISTS user_prefs (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            CREATE TABLE IF NOT EXISTS prompts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT,
                created TEXT
            )
        '''

create_trigger = '''
    CREATE TRIGGER IF NOT EXISTS set_timestamp
    AFTER INSERT ON prompts
    FOR EACH ROW
    BEGIN
        UPDATE prompts SET created = DATETIME('now') WHERE id = NEW.id;
    END;
'''

component_functions = [
    {
        "name": "markdown_component",
        "description": "Use for rendering a text response to the user.",
        "instruction": """
Make sure to only respond with data actually in the database.
Use Markdown to format the text.

Finally, provide an array of strings to be rendered as suggestions for followup user_inputs.
These suggestions will be rendered as buttons for the user to click.
For example, if the user asked for a list of tables in the database, which included tables for bird_facts, and planets,
you might respond with the following suggestions:

list all records in the bird_facts table
get all planets in the planets table, then use the html_component to show them as set of circular divs
how many planets are there in the planets table?

Always provide suggestions for queries that you think the user might want to make next.
This can include the creation of new tables, or the addition of new records to existing tables.
        """,
        "parameters": {
            "type": "object",
            "properties": {
                "content": {
                    "type": "string",
                    "description": "Markdown content to be rendered in the component.",
                },
                "suggestions": {
                    "type": "array",
                    "description": "An array of strings to be rendered as suggestion chips for followup user_inputs.",
                    "nullable": False,
                    "items": {
                        "type": "string",
                        "nullable": False,
                    },
                }
            },
        }
    },
    {
        "name": "html_component",
        "description": "Use for rendering a non-interactive html output. No javascript allowed.",
        "instruction": """
Make sure to only respond with data actually in the database.
Make full use of HTML to format the response.
You can also use CSS to style the response.
Your HTML should be valid and well-formed.
Your HTML should not include double quotes, and nothing should be escaped
The background color of the page is white.

Finally, provide an array of strings to be rendered as suggestions for followup user_inputs.
These suggestions will be rendered as buttons for the user to click.
For example, if the user asked for a list of tables in the database, which included tables for bird_facts, and planets,
you might respond with the following suggestions:

list all records in the bird_facts table
get all planets in the planets table, then use the html_component to show them as set of circular divs
how many planets are there in the planets table?

Always provide suggestions for queries that you think the user might want to make next.
This can include the creation of new tables, or the addition of new records to existing tables.
        """,
        "parameters": {
            "type": "object",
            "properties": {
                "content": {
                    "type": "string",
                    "description": "Markdown content to be rendered in the component.",
                },
                "suggestions": {
                    "type": "array",
                    "description": "An array of strings to be rendered as suggestion chips for followup user_inputs.",
                    "nullable": False,
                    "items": {
                        "type": "string",
                        "nullable": False,
                    },
                }
            },
        }
    },
    {
        "name": "bargraph_component",
        "description": "Use for rendering a comparison of numerical data.",
        "instruction": """
Make sure to only respond with data actually in the database.

The data should be an array of objects, where each object has a label and a value.

Finally, provide an array of strings to be rendered as suggestions for followup user_inputs.
These suggestions will be rendered as buttons for the user to click.
For example, if the user asked for a list of tables in the database, which included tables for bird_facts, and planets,
you might respond with the following suggestions:

list all records in the bird_facts table
get all planets in the planets table, then use the html_component to show them as set of circular divs
how many planets are there in the planets table?

Always provide suggestions for queries that you think the user might want to make next.
This can include the creation of new tables, or the addition of new records to existing tables.
        """,
        "parameters": {
            "type": "object",
            "properties": {
                "content": {
                    "type": "array",
                    "description": "An array of objects, where each object has a label and a value.",
                    "nullable": False,
                    "items": {
                        "type": "object",
                        "nullable": False,
                        "properties": {
                            "label": {
                                "type": "string",
                                "description": "The label for the bar.",
                            },
                            "value": {
                                "type": "number",
                                "description": "The value for the bar.",
                            },
                        }
                    },
                },
                "suggestions": {
                    "type": "array",
                    "description": "An array of strings to be rendered as suggestion chips for followup user_inputs.",
                    "nullable": False,
                    "items": {
                        "type": "string",
                        "nullable": False,
                    },
                }

            },
        }
    },
]

just_markdown_component_function = [
    f for f in component_functions if f['name'] == 'markdown_component']

component_dispatch_description = 'Selects the appropriate component from the following:\n'
for func in component_functions:
    component_dispatch_description += f'{func["name"]}: {func["description"]}\n'

component_dispatch_functions = [
    {
        'name': 'dispatch',
        'description': component_dispatch_description,
        'parameters': {
            'type': 'object',
            'properties': {
                'component_name': {
                    'type': 'string',
                    'enum': [func['name'] for func in component_functions],
                    'nullable': False,
                    'description': 'The name of the component to render.'
                },
            }
        }
    }
]

sql_functions = [
    {
        "name": "sql_queries",
        "description": "Returns an array of SQL queries that are going to be executed in sequence.",
        "parameters": {
            "type": "object",
            "properties": {
                "sql_queries": {
                    "type": "array",
                    "description": "An array of SQL queries that are going to be executed in sequence.",
                    "items": {
                            "type": "string"
                    },
                },
            },
        }
    }
]


def llm(data):
    api_key = data.get("api_key")
    model = data.get("model", "gpt-3.5-turbo")
    openai.api_key = api_key
    response = openai.ChatCompletion.create(
        model=model,
        messages=data.get("messages"),
        functions=oai_functions,
    )
    return response


def component_llm(data):
    api_key = data["api_key"]
    openai.api_key = api_key
    limited_component_functions = [
        func for func in component_functions if func['name'] == data['component_name']]
    if not limited_component_functions:
        limited_component_functions = just_markdown_component_function
    result = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=data["messages"],
        functions=limited_component_functions,
        function_call={"name": data['component_name']}
    )
    first_choice = result["choices"][0]["message"]
    func = first_choice.get("function_call")
    if func:
        function_name = func["name"]
        arguments = func["arguments"]
    else:
        function_name = 'fallback'
        arguments = {'content': first_choice}
    return {'component_name': function_name, 'data': arguments}


def component_dispatch_llm(data):
    api_key = data["api_key"]
    openai.api_key = api_key
    result = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=data["messages"],
        functions=component_dispatch_functions,
        function_call={"name": "dispatch"}
    )
    first_choice = result["choices"][0]["message"]
    func = first_choice.get("function_call")
    if func:
        function_name = func["name"]
        arguments = json.loads(func["arguments"])
        component_name = arguments.get('component_name', 'markdown_component')
    else:
        function_name = 'fallback'
        arguments = {'content': first_choice}
        component_name = 'markdown_component'
    if component_name not in [func['name'] for func in component_functions]:
        component_name = 'markdown_component'
    return component_name


def execute_queries(queries):
    records = []
    for query in queries:
        try:
            result = db.query(query)
            records.extend([row for row in result])
        except Exception as e:
            print(f"Error executing query {query}: {e}")
    return records


def sql_llm(data):
    api_key = data["api_key"]
    openai.api_key = api_key
    result = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=data["messages"],
        functions=sql_functions,
        function_call={"name": "sql_queries"}
    )
    first_choice = result["choices"][0]["message"]
    queries, records = [], []
    if first_choice.get("function_call"):
        func = first_choice["function_call"]
        function_name = func["name"]
        arguments = func["arguments"]
        if function_name == "sql_queries":
            arguments = json.loads(arguments)
            queries = arguments.get("sql_queries", [])
            records = execute_queries(queries)
    return {"queries": queries, "records": records}


def check_and_create_db():
    try:
        result = db.query(create_first_tables)
        db.query(create_trigger)
        print("Database initialized successfully.")
        for row in result:
            print(row)
    except Exception as e:
        print(f"Error initializing database: {e}")


@app.on_event("startup")
async def startup_event():
    check_and_create_db()


@app.post("/universal")
async def universal(request: Request):
    user_input_json = await request.json()
    user_input = user_input_json.get('message')
    user_api_key = user_input_json.get('api_key')

    system_prompt = create_sql_system_prompt()
    prompts = [system_prompt]
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_input},
    ]

    data = {
        "api_key": user_api_key,
        "messages": messages,
        "max_tokens": 500,
        "temperature": 0.5,
        "top_p": 1,
        "frequency_penalty": 0,
        "presence_penalty": 0,
        "stop": ["default_stop"]
    }

    sql_llm_response = sql_llm(data)
    queries = sql_llm_response["queries"]
    records = sql_llm_response["records"]

    component_dispatch_system_prompt = create_dispatch_component_system_prompt(
        user_input,
        queries,
        records)
    prompts.append(component_dispatch_system_prompt)

    data["messages"] = [
        {"role": "system", "content": component_dispatch_system_prompt},
    ]

    component_name = component_dispatch_llm(data)
    data['max_tokens'] = 2000
    data['component_name'] = component_name

    component_system_prompt = create_component_system_prompt(
        user_input,
        queries,
        records,
        component_name)
    prompts.append(component_system_prompt)

    data["messages"] = [
        {"role": "system", "content": component_system_prompt},
    ]

    component_response = component_llm(data)
    component_response_data = component_response.get('data', {})

    return {
        "user_input": user_input,
        "queries": queries,
        "result": records,
        "component_name": component_name,
        "data": component_response_data,
        "prompts": prompts
    }
