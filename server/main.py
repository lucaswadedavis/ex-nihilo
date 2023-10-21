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
        """,
        "parameters": {
            "type": "object",
            "properties": {
                "content": {
                    "type": "string",
                    "description": "Markdown content to be rendered in the component.",
                },
            },
        }
    },
    {
        "name": "html_component",
        "description": "Use for rendering a non-interactive html output. No javascript allowed.",
        "instruction": """
Make sure to only respond with data actually in the database.
Make full use of HTML to format the response.
You can also use CSS to style the response, and the Tailwind CSS framework is available.
Your HTML should be valid and well-formed.
Your HTML will be injected into a React component, so use **className** instead of **class**.
The background color of the page is white.
        """,
        "parameters": {
            "type": "object",
            "properties": {
                "content": {
                    "type": "string",
                    "description": "Markdown content to be rendered in the component.",
                },
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
    api_key = data["api_key"]
    model = data["model"]
    openai.api_key = api_key
    response = openai.ChatCompletion.create(
        model=data["model"] or "gpt-3.5-turbo",
        messages=data["messages"],
        functions=oai_functions,
    )
    return response


def component_llm(data):
    print('---data: ', data)
    api_key = data["api_key"]
    openai.api_key = api_key
    limited_component_functions = [
        func for func in component_functions if func['name'] == data['component_name']]
    if len(limited_component_functions) == 0:
        limited_component_functions = just_markdown_component_function
    print('---limited_component_functions: ', limited_component_functions)
    result = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=data["messages"],
        functions=limited_component_functions,
        function_call={"name": data['component_name']}
    )
    first_choice = result["choices"][0]["message"]
    function_name = ''
    arguments = {}
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
    function_name = ''
    arguments = {}
    func = first_choice.get("function_call")
    if func:
        function_name = func["name"]
        arguments = func["arguments"]
        arguments = json.loads(arguments)
        component_name = arguments.get('component_name')
    else:
        function_name = 'fallback'
        arguments = {'content': first_choice}
    if component_name not in [func['name'] for func in component_functions]:
        component_name = 'markdown_component'
    return component_name


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
    if first_choice["function_call"]:
        func = first_choice["function_call"]
        function_name = func["name"]
        arguments = func["arguments"]
        if function_name == "sql_queries":
            # the arguments are going to be JSON strings, so we need to parse them
            arguments = json.loads(arguments)
            print("---Arguments: ", arguments)
            queries = arguments.get("sql_queries", [])
            # we need to execute the SQL query, but first we ensure that "sql_queries" key exists in arguments
            records = []
            for query in queries:
                try:
                    result = db.query(query)
                    print("Executed query: ", query)
                    print("Query executed successfully.")
                    try:
                        for row in result:
                            print(row)
                            records.append(row)
                    except Exception as e:
                        print("Error getting result rows: ", e)
                except Exception as e:
                    print("Error executing query: ", e)
    return {"queries": queries, "records": records}


def create_table(table_name: str, schema: str):
    try:
        result = db.query(
            f'CREATE TABLE IF NOT EXISTS {table_name} ({schema})')
        print(f"Table {table_name} created successfully.")
        for row in result:
            print(row)
    except Exception as e:
        print(f"Error creating table {table_name}: ", e)


def check_and_create_db():
    try:
        result = db.query(create_first_tables)
        db.query(create_trigger)
        print("Table created successfully.")
        for row in result:
            print(row)
    except Exception as e:
        print("Error creating table: ", e)


@app.on_event("startup")
async def startup_event():
    check_and_create_db()


@app.post("/universal")
async def universal(request: Request):
    prompts = []
    user_input_json = await request.json()
    user_input = user_input_json.get('message')
    user_api_key = user_input_json.get('api_key')
    system_prompt = create_sql_system_prompt()
    prompts.append(system_prompt)
    table = db['prompts']
    table.insert({'text': system_prompt})
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
    print('----- RECORDS')
    print(records)
    print(type(records))
    component_dispatch_system_prompt = create_dispatch_component_system_prompt(
        user_input,
        queries,
        records)
    prompts.append(component_dispatch_system_prompt)
    table = db['prompts']
    table.insert({'text': component_dispatch_system_prompt})
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
    table = db['prompts']
    table.insert({'text': component_system_prompt})
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