# Cashvio Backend Services

Welcome to the Cashvio Backend documentation. This is a microservices-based system for POS and inventory management.

## Overview

Cashvio consists of four main microservices:

- **Auth Service** - Authentication, JWT tokens, Google OAuth, and user management
- **Stock Service** - Inventory, products, categories, and stock levels management
- **Order Service** - Order processing, customer management, receipt generation, and cashflow
- **Mailer-Uploader Service** - Email notifications and file uploads to AWS S3

## Key Features

- **Microservices Architecture** - Independent, scalable services
- **Real-time Communication** - RabbitMQ message broker
- **Cloud Integration** - AWS S3, KMS, and Google OAuth
- **Database** - Shared PostgreSQL database
- **API Documentation** - Comprehensive Postman collection

## Quick Links

- [Architecture Overview](architecture.md)
- [API Documentation](api.md)
- [Development Guide](development.md)
- [Deployment Guide](deployment.md)

## Getting Started

For development setup, see our [Development Guide](development.md).

For API testing, use our [Postman Collection](https://github.com/yasithranusha/cashvio-backend/blob/main/cashvio_postman_collection.json).