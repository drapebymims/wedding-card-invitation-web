# Cognito User Pool — wedding-card-invitation-web staff/admin
resource "aws_cognito_user_pool" "main" {
  name = "wedding-card-invitation-web-${var.stage}-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  schema {
    # NOTE: use "role" (not "custom:role") — Cognito auto-prefixes custom attributes.
    name                = "role"
    attribute_data_type = "String"
    mutable             = true
    required            = false
  }

  tags = { Name = "wedding-card-invitation-web-${var.stage}-users" }

  lifecycle {
    ignore_changes = [schema]
  }
}

# Cognito App Client (web SPA, implicit flow)
resource "aws_cognito_user_pool_client" "web" {
  name         = "wedding-card-invitation-web-${var.stage}-web"
  user_pool_id = aws_cognito_user_pool.main.id
  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
  ]

  allowed_oauth_flows                  = ["implicit"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                = ["openid", "email", "profile"]

  callback_urls = [
    "${var.frontend_url}/admin/login",
    "http://localhost:5173/admin/login",
  ]
  logout_urls = [
    var.frontend_url,
    "http://localhost:5173",
  ]

  # Google is added only when google_client_id is set (see below).
  supported_identity_providers = concat(
    ["COGNITO"],
    var.google_client_id != "" ? ["Google"] : [],
  )
}

# Optional Google social login — created only when google_client_id is provided.
resource "aws_cognito_identity_provider" "google" {
  count         = var.google_client_id != "" ? 1 : 0
  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Google"
  provider_type = "Google"

  attribute_mapping = {
    email    = "email"
    name     = "name"
    username = "sub"
  }

  provider_details = {
    authorize_scopes = "email profile openid"
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret
  }
}

# Cognito Domain
resource "aws_cognito_user_pool_domain" "main" {
  domain       = var.cognito_domain_prefix
  user_pool_id = aws_cognito_user_pool.main.id
}
