CREATE TABLE IF NOT EXISTS contacts (
  id            SERIAL PRIMARY KEY,
  agent         VARCHAR(20)  NOT NULL DEFAULT 'laura',
  campaign      VARCHAR(80),
  company       VARCHAR(200),
  contact_name  VARCHAR(200),
  title         VARCHAR(200),
  email         VARCHAR(200),
  linkedin_url  TEXT,
  role          VARCHAR(200),
  location      VARCHAR(200),
  touch1        VARCHAR(200),
  touch2        VARCHAR(200),
  touch3        VARCHAR(200),
  touch4        VARCHAR(200),
  touch5        VARCHAR(200),
  response_status   VARCHAR(200),
  response_date     VARCHAR(80),
  call_scheduled    VARCHAR(80),
  next_action       VARCHAR(200),
  notes         TEXT,
  tier          VARCHAR(50),
  hiring_evidence   TEXT,
  smtp_status   VARCHAR(100),
  assigned_to   VARCHAR(100),
  blacklisted   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_agent        ON contacts(agent);
CREATE INDEX IF NOT EXISTS idx_contacts_campaign     ON contacts(campaign);
CREATE INDEX IF NOT EXISTS idx_contacts_blacklisted  ON contacts(blacklisted);
CREATE INDEX IF NOT EXISTS idx_contacts_email        ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_company      ON contacts(company);
