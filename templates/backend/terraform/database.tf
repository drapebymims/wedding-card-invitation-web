# Secrets Manager — DB Credentials
resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "wedding-card-invitation-web-${var.stage}-db-credentials"
  description = "RDS PostgreSQL credentials for wedding-card-invitation-web ${var.stage}"
  tags        = { Name = "wedding-card-invitation-web-${var.stage}-db-credentials" }
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db_master.result
    host     = aws_db_instance.repo.address
    port     = 5432
    dbname   = var.db_name
  })
}

resource "random_password" "db_master" {
  length  = 24
  special = false
}

# RDS PostgreSQL (public, db.t4g.micro) — no VPC needed for Lambda
resource "aws_security_group" "repo_db" {
  name        = "wedding-card-invitation-web-${var.stage}-db"
  description = "Allow PostgreSQL access to wedding-card-invitation-web RDS"
  tags        = { Name = "wedding-card-invitation-web-${var.stage}-db-sg" }
}

resource "aws_vpc_security_group_ingress_rule" "repo_db_5432" {
  security_group_id = aws_security_group.repo_db.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 5432
  to_port           = 5432
  ip_protocol       = "tcp"
}

resource "aws_db_instance" "repo" {
  identifier              = "wedding-card-invitation-web-${var.stage}-pg"
  engine                  = "postgres"
  engine_version          = "16.9"
  instance_class          = var.db_instance_class
  allocated_storage       = 20
  storage_encrypted       = true
  storage_type            = "gp3"
  db_name                 = var.db_name
  username                = var.db_username
  password                = random_password.db_master.result
  port                    = 5432
  publicly_accessible     = true
  skip_final_snapshot     = var.stage != "prod"
  backup_retention_period = var.db_backup_retention
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"
  deletion_protection     = var.stage == "prod"
  apply_immediately       = var.stage != "prod"
  vpc_security_group_ids  = [aws_security_group.repo_db.id]

  tags = {
    Name = "wedding-card-invitation-web-${var.stage}-db"
    Env  = var.stage
  }
}
