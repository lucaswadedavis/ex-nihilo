export const isBrowser = () => typeof window !== "undefined";

const ls = {
  getItem: (key: string) => {
    if (isBrowser()) {
      return window.localStorage.getItem(key);
    }
    return null;
  },

  setItem: (key: string, value: string) => {
    if (isBrowser()) {
      window.localStorage.setItem(key, value);
    }
  },

  removeItem: (key: string) => {
    if (isBrowser()) {
      window.localStorage.removeItem(key);
    }
  },
};

export default ls;
