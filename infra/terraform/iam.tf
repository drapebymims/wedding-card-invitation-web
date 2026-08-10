# IAM role for Amplify (frontend hosting)
resource "aws_iam_role" "amplify_service" {
  name = "wedding-card-invitation-web-${var.stage}-amplify-service"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "amplify.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })

  tags = { Name = "wedding-card-invitation-web-${var.stage}-amplify-service" }
}

resource "aws_iam_role_policy_attachment" "amplify_admin" {
  role       = aws_iam_role.amplify_service.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess-Amplify"
}

# The Lambda execution role is NOT created here — each service's serverless.yml
# declares its own `provider.iam.role.statements` (secretsmanager, s3, ses,
# cognito-idp). API Gateway is owned by Serverless Framework too, never Terraform.
