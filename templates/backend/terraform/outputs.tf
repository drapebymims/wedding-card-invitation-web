output "db_endpoint" {
  value = aws_db_instance.repo.address
}

output "db_secret_name" {
  description = "Secrets Manager secret the Lambda layer reads for DB credentials."
  value       = aws_secretsmanager_secret.db_credentials.name
}

output "db_secret_arn" {
  value = aws_secretsmanager_secret.db_credentials.arn
}

output "cognito_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "cognito_domain" {
  value = aws_cognito_user_pool_domain.main.domain
}

output "receipts_bucket" {
  value = aws_s3_bucket.receipts.id
}

output "assets_bucket" {
  value = aws_s3_bucket.assets.id
}

output "assets_cdn_domain" {
  value = aws_cloudfront_distribution.assets.domain_name
}
