-- Create label templates table
CREATE TABLE IF NOT EXISTS label_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  config JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_label_templates_created_by ON label_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_label_templates_is_default ON label_templates(is_default);

-- Add RLS policies
ALTER TABLE label_templates ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own templates and public templates
CREATE POLICY label_templates_select_policy ON label_templates 
  FOR SELECT USING (
    auth.uid() = created_by OR 
    is_default = true
  );

-- Allow users to insert their own templates
CREATE POLICY label_templates_insert_policy ON label_templates 
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Allow users to update their own templates
CREATE POLICY label_templates_update_policy ON label_templates 
  FOR UPDATE USING (auth.uid() = created_by);

-- Allow users to delete their own templates
CREATE POLICY label_templates_delete_policy ON label_templates 
  FOR DELETE USING (auth.uid() = created_by);
