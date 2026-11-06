# The Lab's server side is deliberately tiny. Pyodide runs user code and OPFS
# keeps the live files in the browser; the backend only stores cloud copies
# so code survives a cleared browser, keyed by the Supabase uid.
