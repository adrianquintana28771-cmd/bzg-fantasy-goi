-- Pure immutable timestamp predicate: no data access, needed by read-only regression checks.
GRANT EXECUTE ON FUNCTION private.mission_code_available(timestamptz,timestamptz,timestamptz) TO PUBLIC;