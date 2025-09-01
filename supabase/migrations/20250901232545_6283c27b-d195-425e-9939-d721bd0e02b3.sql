-- Create a trigger to automatically lowercase emails on insert/update for doctors table
CREATE OR REPLACE FUNCTION lowercase_email_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email = LOWER(NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for doctors table
CREATE TRIGGER ensure_lowercase_email
  BEFORE INSERT OR UPDATE ON doctors
  FOR EACH ROW
  EXECUTE FUNCTION lowercase_email_trigger();