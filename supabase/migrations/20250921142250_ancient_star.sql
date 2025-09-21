/*
  # Enhanced Workflow System for Department-Area-Contractor Integration

  1. New Tables
    - `areas` - Geographic areas managed by area super admins
    - `departments` - Government departments with area assignments
    - `issue_assignments` - Track issue assignments through workflow
    - `work_progress` - Track contractor work progress
    - `tender_evaluations` - Tender evaluation and scoring

  2. Enhanced Tables
    - Add workflow_stage to issues for better tracking
    - Add assignment fields to profiles
    - Add department relationships

  3. Security
    - Enable RLS on all new tables
    - Add policies for area admins and department admins
    - Add contractor-specific policies
*/

-- Create areas table
CREATE TABLE IF NOT EXISTS areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  description text,
  state_id text,
  district_id text,
  boundaries jsonb, -- GeoJSON boundaries
  population integer,
  area_size_km2 decimal(10, 2),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  category text NOT NULL CHECK (category IN ('public_works', 'utilities', 'environment', 'safety', 'parks', 'administration')),
  description text,
  contact_email text,
  contact_phone text,
  office_address text,
  budget_allocation decimal(15, 2),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create issue assignments table for tracking workflow
CREATE TABLE IF NOT EXISTS issue_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid REFERENCES issues(id) ON DELETE CASCADE NOT NULL,
  assigned_by uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  assigned_area_id uuid REFERENCES areas(id) ON DELETE SET NULL,
  assignment_type text NOT NULL CHECK (assignment_type IN ('admin_to_area', 'area_to_department', 'department_to_contractor')),
  assignment_notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'reassigned', 'cancelled')),
  due_date timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create work progress table
CREATE TABLE IF NOT EXISTS work_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid REFERENCES issues(id) ON DELETE CASCADE,
  tender_id uuid REFERENCES tenders(id) ON DELETE CASCADE,
  contractor_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('not_started', 'in_progress', 'completed', 'on_hold', 'cancelled')),
  images text[], -- Progress photos
  documents text[], -- Progress documents
  materials_used text[],
  labor_hours decimal(8, 2),
  expenses_incurred decimal(15, 2),
  quality_rating integer CHECK (quality_rating >= 1 AND quality_rating <= 5),
  supervisor_notes text,
  contractor_notes text,
  milestone_reached text,
  next_milestone text,
  estimated_completion_date date,
  actual_completion_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create tender evaluations table
CREATE TABLE IF NOT EXISTS tender_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid REFERENCES tenders(id) ON DELETE CASCADE NOT NULL,
  bid_id uuid REFERENCES bids(id) ON DELETE CASCADE NOT NULL,
  evaluator_id uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  technical_score decimal(5, 2) CHECK (technical_score >= 0 AND technical_score <= 100),
  financial_score decimal(5, 2) CHECK (financial_score >= 0 AND financial_score <= 100),
  experience_score decimal(5, 2) CHECK (experience_score >= 0 AND experience_score <= 100),
  timeline_score decimal(5, 2) CHECK (timeline_score >= 0 AND timeline_score <= 100),
  total_score decimal(5, 2) CHECK (total_score >= 0 AND total_score <= 100),
  evaluation_notes text,
  recommendation text CHECK (recommendation IN ('accept', 'reject', 'request_clarification')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tender_id, bid_id, evaluator_id)
);

-- Add workflow_stage to issues if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'issues' AND column_name = 'workflow_stage'
  ) THEN
    ALTER TABLE issues ADD COLUMN workflow_stage text DEFAULT 'reported' CHECK (workflow_stage IN ('reported', 'area_review', 'department_assigned', 'contractor_assigned', 'in_progress', 'department_review', 'resolved'));
  END IF;
END $$;

-- Add assignment fields to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'assigned_area_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN assigned_area_id uuid REFERENCES areas(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'assigned_department_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN assigned_department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add current assignee to issues if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'issues' AND column_name = 'current_assignee_id'
  ) THEN
    ALTER TABLE issues ADD COLUMN current_assignee_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'issues' AND column_name = 'assigned_area_id'
  ) THEN
    ALTER TABLE issues ADD COLUMN assigned_area_id uuid REFERENCES areas(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'issues' AND column_name = 'assigned_department_id'
  ) THEN
    ALTER TABLE issues ADD COLUMN assigned_department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add department_id to tenders if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenders' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE tenders ADD COLUMN department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenders' AND column_name = 'source_issue_id'
  ) THEN
    ALTER TABLE tenders ADD COLUMN source_issue_id uuid REFERENCES issues(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Update user_type constraint to include new admin types
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_type_check;
  
  -- Add new constraint with all user types
  ALTER TABLE profiles ADD CONSTRAINT profiles_user_type_check 
    CHECK (user_type IN ('user', 'admin', 'area_super_admin', 'department_admin', 'tender'));
END $$;

-- Enable RLS on new tables
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE tender_evaluations ENABLE ROW LEVEL SECURITY;

-- Areas policies
CREATE POLICY "Anyone can read active areas"
  ON areas FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage areas"
  ON areas FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Departments policies
CREATE POLICY "Anyone can read active departments"
  ON departments FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage departments"
  ON departments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Issue assignments policies
CREATE POLICY "Users can read relevant assignments"
  ON issue_assignments FOR SELECT TO authenticated
  USING (
    assigned_by = auth.uid() OR
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND user_type IN ('admin', 'area_super_admin', 'department_admin')
    )
  );

CREATE POLICY "Admins can create assignments"
  ON issue_assignments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = assigned_by AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND user_type IN ('admin', 'area_super_admin', 'department_admin')
    )
  );

-- Work progress policies
CREATE POLICY "Contractors can manage own work progress"
  ON work_progress FOR ALL TO authenticated
  USING (
    auth.uid() = contractor_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND user_type IN ('admin', 'area_super_admin', 'department_admin')
    )
  );

-- Tender evaluations policies
CREATE POLICY "Evaluators can manage evaluations"
  ON tender_evaluations FOR ALL TO authenticated
  USING (
    auth.uid() = evaluator_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND user_type IN ('admin', 'department_admin')
    )
  );

-- Insert sample areas
INSERT INTO areas (name, code, description, state_id, district_id, is_active) VALUES
('Central Business District', 'CBD', 'Main commercial and business area', '1', '1-1', true),
('Residential Zone A', 'RZA', 'Primary residential area with schools and parks', '1', '1-1', true),
('Industrial Area', 'IND', 'Manufacturing and industrial zone', '1', '1-1', true),
('Suburban Area', 'SUB', 'Suburban residential area', '1', '1-1', true),
('Historic District', 'HIS', 'Historic preservation area', '1', '1-1', true);

-- Insert sample departments
INSERT INTO departments (name, code, category, description, contact_email, contact_phone, is_active) VALUES
('Public Works Department', 'PWD', 'public_works', 'Responsible for roads, infrastructure, and public facilities', 'pwd@city.gov', '+1-555-0201', true),
('Water & Utilities Department', 'WUD', 'utilities', 'Manages water supply, sewage, and utility services', 'water@city.gov', '+1-555-0202', true),
('Parks & Recreation Department', 'PRD', 'parks', 'Maintains parks, recreational facilities, and community programs', 'parks@city.gov', '+1-555-0203', true),
('Environmental Services', 'ENV', 'environment', 'Environmental protection and sustainability programs', 'environment@city.gov', '+1-555-0204', true),
('Public Safety Department', 'PSD', 'safety', 'Public safety, emergency response, and security', 'safety@city.gov', '+1-555-0205', true);

-- Create indexes for new tables
CREATE INDEX IF NOT EXISTS idx_areas_code ON areas(code);
CREATE INDEX IF NOT EXISTS idx_areas_is_active ON areas(is_active);

CREATE INDEX IF NOT EXISTS idx_departments_code ON departments(code);
CREATE INDEX IF NOT EXISTS idx_departments_category ON departments(category);
CREATE INDEX IF NOT EXISTS idx_departments_is_active ON departments(is_active);

CREATE INDEX IF NOT EXISTS idx_issue_assignments_issue_id ON issue_assignments(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_assignments_assigned_by ON issue_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_issue_assignments_assigned_to ON issue_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issue_assignments_status ON issue_assignments(status);

CREATE INDEX IF NOT EXISTS idx_work_progress_contractor_id ON work_progress(contractor_id);
CREATE INDEX IF NOT EXISTS idx_work_progress_status ON work_progress(status);
CREATE INDEX IF NOT EXISTS idx_work_progress_issue_id ON work_progress(issue_id);
CREATE INDEX IF NOT EXISTS idx_work_progress_tender_id ON work_progress(tender_id);

CREATE INDEX IF NOT EXISTS idx_tender_evaluations_tender_id ON tender_evaluations(tender_id);
CREATE INDEX IF NOT EXISTS idx_tender_evaluations_bid_id ON tender_evaluations(bid_id);

-- Add triggers for new tables
CREATE TRIGGER update_areas_updated_at BEFORE UPDATE ON areas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_issue_assignments_updated_at BEFORE UPDATE ON issue_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_work_progress_updated_at BEFORE UPDATE ON work_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tender_evaluations_updated_at BEFORE UPDATE ON tender_evaluations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to auto-assign issues to area admins
CREATE OR REPLACE FUNCTION auto_assign_issue_to_area()
RETURNS TRIGGER AS $$
BEGIN
  -- Set workflow stage to area_review for new issues
  NEW.workflow_stage = 'area_review';
  
  -- Try to auto-assign to area based on location
  IF NEW.area IS NOT NULL THEN
    -- Find area super admin for this area
    UPDATE issues SET
      assigned_area_id = (
        SELECT a.id FROM areas a
        WHERE a.name = NEW.area AND a.is_active = true
        LIMIT 1
      ),
      current_assignee_id = (
        SELECT p.id FROM profiles p
        JOIN areas a ON p.assigned_area_id = a.id
        WHERE a.name = NEW.area AND p.user_type = 'area_super_admin' AND p.is_verified = true
        LIMIT 1
      )
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-assignment
DROP TRIGGER IF EXISTS auto_assign_new_issues ON issues;
CREATE TRIGGER auto_assign_new_issues
  BEFORE INSERT ON issues
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_issue_to_area();

-- Create function to handle tender award workflow
CREATE OR REPLACE FUNCTION handle_tender_award()
RETURNS TRIGGER AS $$
BEGIN
  -- When a tender is awarded, update the source issue
  IF NEW.status = 'awarded' AND OLD.status != 'awarded' THEN
    UPDATE issues SET
      workflow_stage = 'contractor_assigned',
      status = 'in_progress',
      current_assignee_id = NEW.awarded_to,
      updated_at = now()
    WHERE id = NEW.source_issue_id;
    
    -- Create assignment record
    INSERT INTO issue_assignments (
      issue_id,
      assigned_by,
      assigned_to,
      assignment_type,
      assignment_notes,
      status
    ) VALUES (
      NEW.source_issue_id,
      auth.uid(),
      NEW.awarded_to,
      'department_to_contractor',
      'Tender awarded - contractor assigned',
      'active'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tender awards
DROP TRIGGER IF EXISTS handle_tender_awards ON tenders;
CREATE TRIGGER handle_tender_awards
  AFTER UPDATE ON tenders
  FOR EACH ROW
  EXECUTE FUNCTION handle_tender_award();

-- Create function to update issue counts
CREATE OR REPLACE FUNCTION update_issue_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update upvotes/downvotes count on issues table
  IF TG_TABLE_NAME = 'issue_votes' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.vote_type = 'upvote' THEN
        UPDATE issues SET upvotes = upvotes + 1 WHERE id = NEW.issue_id;
      ELSIF NEW.vote_type = 'downvote' THEN
        UPDATE issues SET downvotes = downvotes + 1 WHERE id = NEW.issue_id;
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      IF OLD.vote_type = 'upvote' THEN
        UPDATE issues SET upvotes = GREATEST(upvotes - 1, 0) WHERE id = OLD.issue_id;
      ELSIF OLD.vote_type = 'downvote' THEN
        UPDATE issues SET downvotes = GREATEST(downvotes - 1, 0) WHERE id = OLD.issue_id;
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      -- Handle vote type change
      IF OLD.vote_type = 'upvote' AND NEW.vote_type = 'downvote' THEN
        UPDATE issues SET upvotes = GREATEST(upvotes - 1, 0), downvotes = downvotes + 1 WHERE id = NEW.issue_id;
      ELSIF OLD.vote_type = 'downvote' AND NEW.vote_type = 'upvote' THEN
        UPDATE issues SET downvotes = GREATEST(downvotes - 1, 0), upvotes = upvotes + 1 WHERE id = NEW.issue_id;
      END IF;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for vote counting
DROP TRIGGER IF EXISTS update_issue_vote_counts ON issue_votes;
CREATE TRIGGER update_issue_vote_counts
  AFTER INSERT OR UPDATE OR DELETE ON issue_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_issue_counts();

-- Create function to handle profile creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (
    id,
    email,
    user_type,
    full_name,
    first_name,
    last_name,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'user'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    now(),
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();