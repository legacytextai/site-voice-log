ALTER TABLE daily_reports ADD COLUMN project_name text;

CREATE UNIQUE INDEX uq_daily_reports_user_date_project
  ON daily_reports(user_id, report_date, project_name);

CREATE INDEX idx_admin_reports_user_date_project
  ON admin_reports(user_id, report_date, project_name);