variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "ap-southeast-1"
}

variable "stage" {
  description = "Deployment stage (dev/prod)"
  type        = string
  default     = "dev"
}

variable "bucket_suffix" {
  description = "Suffix appended to S3 bucket names (globally unique — set per account)"
  type        = string
  default     = ""
}

variable "db_instance_class" {
  description = "RDS PostgreSQL instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_backup_retention" {
  description = "RDS backup retention in days (free tier max = 1)"
  type        = number
  default     = 1
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "repo"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "repo_admin"
}

# Cognito
variable "cognito_domain_prefix" {
  description = "Cognito domain prefix (must be globally unique)"
  type        = string
  default     = "repo-auth-dev"
}

variable "google_client_id" {
  description = "Google OAuth client ID for Cognito social login (optional — leave empty to disable)"
  type        = string
  default     = ""
}

variable "google_client_secret" {
  description = "Google OAuth client secret for Cognito social login (optional)"
  type        = string
  default     = ""
}

# Admin
variable "admin_email" {
  description = "Admin user email for the dashboard"
  type        = string
  default     = ""
}

# Frontend
variable "frontend_url" {
  description = "Frontend base URL (for Cognito callback URLs)"
  type        = string
  default     = "http://localhost:5173"
}
