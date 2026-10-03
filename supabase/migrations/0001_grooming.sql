CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TABLE clients (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(trim(name))>0), external_id text UNIQUE, email text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '', suburb text NOT NULL DEFAULT '', emergency_contact text NOT NULL DEFAULT '', consent_ref text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true, raw_import jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER clients_touch BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TABLE pets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid NOT NULL REFERENCES clients(id), name text NOT NULL CHECK(length(trim(name))>0), external_id text UNIQUE, species text NOT NULL DEFAULT 'dog', breed text NOT NULL DEFAULT '', temperament text NOT NULL DEFAULT '', care_notes text NOT NULL DEFAULT '', rebook_days integer NOT NULL DEFAULT 42 CHECK(rebook_days BETWEEN 1 AND 730), last_groom date, active boolean NOT NULL DEFAULT true, raw_import jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER pets_touch BEFORE UPDATE ON pets FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TABLE staff (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER staff_touch BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TABLE resources (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, kind text NOT NULL CHECK(kind IN ('van','salon')), active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER resources_touch BEFORE UPDATE ON resources FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TABLE services (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, duration_minutes integer NOT NULL CHECK(duration_minutes BETWEEN 1 AND 720), price_cents integer NOT NULL CHECK(price_cents>=0), currency text NOT NULL DEFAULT 'NZD' CHECK(currency IN ('NZD','AUD')), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER services_touch BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TABLE appointments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pet_id uuid NOT NULL REFERENCES pets(id), staff_id uuid NOT NULL REFERENCES staff(id), resource_id uuid NOT NULL REFERENCES resources(id), service_id uuid NOT NULL REFERENCES services(id), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'booked' CHECK(status IN ('booked','checked-in','completed','cancelled','no-show')), price_cents integer NOT NULL CHECK(price_cents>=0), currency text NOT NULL CHECK(currency IN ('NZD','AUD')), notes text NOT NULL DEFAULT '', CHECK(ends_at>starts_at), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER appointments_touch BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TABLE payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), appointment_id uuid NOT NULL REFERENCES appointments(id), amount_cents integer NOT NULL CHECK(amount_cents>0), reference text NOT NULL UNIQUE, recorded_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER payments_touch BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TABLE vaccinations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pet_id uuid NOT NULL REFERENCES pets(id), name text NOT NULL, expires_on date NOT NULL, evidence_ref text NOT NULL CHECK(length(trim(evidence_ref))>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER vaccinations_touch BEFORE UPDATE ON vaccinations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TABLE care_checks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), appointment_id uuid NOT NULL REFERENCES appointments(id), kind text NOT NULL CHECK(kind IN ('admission','welfare','handover')), observations text NOT NULL CHECK(length(trim(observations))>0), recorded_by text NOT NULL CHECK(length(trim(recorded_by))>0), checked_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER care_checks_touch BEFORE UPDATE ON care_checks FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TABLE incidents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pet_id uuid NOT NULL REFERENCES pets(id), summary text NOT NULL CHECK(length(trim(summary))>0), urgent boolean NOT NULL DEFAULT false, action text NOT NULL DEFAULT '', resolved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER incidents_touch BEFORE UPDATE ON incidents FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TABLE waitlist (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pet_id uuid NOT NULL REFERENCES pets(id), wanted_on date NOT NULL, notes text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER waitlist_touch BEFORE UPDATE ON waitlist FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX appointments_time ON appointments(starts_at, ends_at);
CREATE INDEX appointments_pet ON appointments(pet_id);
CREATE INDEX care_checks_appointment ON care_checks(appointment_id);
CREATE INDEX pets_client ON pets(client_id);
CREATE VIEW v_schedule AS
 SELECT a.id,a.starts_at,a.ends_at,p.name AS pet,c.name AS client,c.phone,c.suburb,c.address,s.name AS groomer,r.name AS resource,r.kind AS resource_kind,sv.name AS service,a.status,a.price_cents,a.currency,p.temperament,p.care_notes
 FROM appointments a JOIN pets p ON p.id=a.pet_id JOIN clients c ON c.id=p.client_id JOIN staff s ON s.id=a.staff_id JOIN resources r ON r.id=a.resource_id JOIN services sv ON sv.id=a.service_id;
CREATE VIEW v_rebooking AS
 SELECT p.id,p.name AS pet,c.name AS client,c.phone,c.suburb,p.last_groom,p.rebook_days,p.last_groom+p.rebook_days AS due_on,
 current_date-(p.last_groom+p.rebook_days) AS days_overdue,p.temperament,p.care_notes
 FROM pets p JOIN clients c ON c.id=p.client_id WHERE p.active AND c.active
 AND NOT EXISTS(SELECT 1 FROM appointments a WHERE a.pet_id=p.id AND a.status IN ('booked','checked-in') AND a.ends_at>=now());
CREATE VIEW v_balances AS
 SELECT a.id,p.name AS pet,c.name AS client,a.starts_at,a.status,a.price_cents,a.currency,COALESCE(sum(pay.amount_cents),0)::integer AS paid_cents,
 (a.price_cents-COALESCE(sum(pay.amount_cents),0))::integer AS balance_cents
 FROM appointments a JOIN pets p ON p.id=a.pet_id JOIN clients c ON c.id=p.client_id LEFT JOIN payments pay ON pay.appointment_id=a.id
 WHERE a.status NOT IN ('cancelled','no-show') GROUP BY a.id,p.name,c.name;
CREATE VIEW v_compliance AS
 SELECT p.id AS record_id,p.name AS pet,'NZ-TH4'::text AS rule,'Missing emergency veterinary consent reference'::text AS issue,
 'https://www.mpi.govt.nz/dmsdocument/30795/direct'::text AS source
 FROM pets p JOIN clients c ON c.id=p.client_id WHERE p.active AND c.active AND c.consent_ref=''
 UNION ALL
 SELECT a.id,p.name,'NZ-TH4','Missing admission assessment','https://www.mpi.govt.nz/dmsdocument/30795/direct'
 FROM appointments a JOIN pets p ON p.id=a.pet_id WHERE a.status IN ('checked-in','completed') AND NOT EXISTS(SELECT 1 FROM care_checks cc WHERE cc.appointment_id=a.id AND cc.kind='admission')
 UNION ALL
 SELECT i.id,p.name,'NZ-TH5','Urgent incident needs recorded response','https://www.mpi.govt.nz/dmsdocument/30795/direct'
 FROM incidents i JOIN pets p ON p.id=i.pet_id WHERE i.urgent AND i.resolved_at IS NULL AND i.action=''
 UNION ALL
 SELECT a.id,p.name,'NZ-TH5','Review welfare observations during stay','https://www.mpi.govt.nz/dmsdocument/30795/direct'
 FROM appointments a JOIN pets p ON p.id=a.pet_id WHERE a.status='checked-in' AND NOT EXISTS(SELECT 1 FROM care_checks cc WHERE cc.appointment_id=a.id AND cc.checked_at>now()-interval '4 hours')
 UNION ALL
 SELECT p.id,p.name,'HOUSE-VACCINE','Missing or expired vaccination evidence','docs/compliance.md#house-rules'
 FROM pets p WHERE p.active AND NOT EXISTS(SELECT 1 FROM vaccinations v WHERE v.pet_id=p.id AND v.expires_on>=current_date)
 UNION ALL
 SELECT p.id,p.name,'HOUSE-CONTACT','Missing emergency contact','docs/compliance.md#house-rules'
 FROM pets p JOIN clients c ON c.id=p.client_id WHERE p.active AND c.active AND c.emergency_contact='';
CREATE VIEW v_attention AS
 SELECT id AS record_id,pet,'Rebooking overdue'::text AS reason,due_on AS due_on FROM v_rebooking WHERE days_overdue>0
 UNION ALL SELECT id,pet,'Completed appointment has unpaid balance',starts_at::date FROM v_balances WHERE status='completed' AND balance_cents>0
 UNION ALL SELECT a.id,p.name,'Appointment has not been closed',a.starts_at::date FROM appointments a JOIN pets p ON p.id=a.pet_id WHERE a.status IN ('booked','checked-in') AND a.ends_at<now()
 UNION ALL SELECT i.id,p.name,'Incident still open',i.created_at::date FROM incidents i JOIN pets p ON p.id=i.pet_id WHERE i.resolved_at IS NULL;
