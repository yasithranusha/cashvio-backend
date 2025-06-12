# Auth Service

## Overview

The Auth Service handles authentication, JWT token management, Google OAuth integration, and user management for the Cashvio platform.

## Key Features

- **JWT Authentication**: Access and refresh token management
- **Google OAuth**: Social login integration
- **User Registration**: OTP-based email verification
- **Role-based Access**: Support for SHOP_OWNER, SHOP_STAFF, CUSTOMER, ADMIN roles
- **Multi-tenant**: Shop-based user management

## Endpoints

### Authentication Endpoints

#### POST /auth/login
User authentication with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "role": "SHOP_OWNER"
  }
}
```

#### POST /auth/refresh
Refresh expired access tokens using refresh token.

**Headers:**
```
Authorization: Bearer <refresh_token>
```

#### GET /auth/google
Initiate Google OAuth authentication flow.

#### POST /auth/logout
Logout user and invalidate tokens.

### User Registration

#### POST /auth/otp/generate
Generate and send OTP for email verification.

**Request:**
```json
{
  "email": "newuser@example.com",
  "name": "John Doe"
}
```

#### POST /auth/register
Register new user with OTP verification.

**Request:**
```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "password123",
  "businessName": "My Shop",
  "shopCategory": "Electronics",
  "address": "123 Main St",
  "contactPhone": "+94761234567",
  "contactNumber": "+94761234567",
  "shopLogo": "https://example.com/logo.png",
  "shopBanner": "https://example.com/banner.png",
  "profileImage": "https://example.com/profile.jpg",
  "dob": "1990-01-01T00:00:00.000Z",
  "otp": "123456"
}
```

### User Management

#### GET /users
Get users with pagination and filtering.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `role`: Filter by role (ADMIN, SHOP_OWNER, SHOP_STAFF, CUSTOMER)
- `status`: Filter by status (ACTIVE, INACTIVE, SUSPENDED)

#### GET /users/:id
Get user by ID.

#### GET /users/email/:email
Get user by email address.

#### PUT /users/:id
Update user information.

**Request:**
```json
{
  "name": "Updated Name",
  "dob": "1995-04-09T00:00:00.000Z"
}
```

#### DELETE /users/:id
Delete user account.

#### GET /shops/:shopId/customers
Get customers of a specific shop.

## Authentication Flow

### Standard Login
1. User submits email/password
2. Service validates credentials
3. Returns JWT access token (15min) and refresh token (7 days)
4. Client uses access token for API requests
5. When access token expires, use refresh token to get new tokens

### Google OAuth Flow
1. Client redirects to `/auth/google`
2. User authenticates with Google
3. Google redirects back with authorization code
4. Service exchanges code for user info
5. Creates/updates user account
6. Returns JWT tokens

### Registration Flow
1. Generate OTP: `POST /auth/otp/generate`
2. User receives OTP via email
3. Complete registration: `POST /auth/register` with OTP
4. Account created and shop initialized

## Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Security**: RS256 algorithm with rotating secrets
- **Rate Limiting**: Login attempt restrictions
- **Input Validation**: Email format, password strength
- **CORS Protection**: Configured for frontend domains

## Configuration

### Environment Variables
```bash
# JWT Configuration
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8080/auth/google/callback

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/cashvio

# Email Service (via RabbitMQ)
RABBITMQ_URL=amqp://localhost:5672
```

## Database Schema

### User Table
- `id`: UUID primary key
- `name`: User full name
- `email`: Unique email address
- `password`: Hashed password
- `role`: User role enum
- `status`: Account status
- `profileImage`: Profile picture URL
- `contactNumber`: Phone number
- `dob`: Date of birth
- `shopId`: Associated shop ID
- `createdAt`: Account creation timestamp
- `updatedAt`: Last modification timestamp

### Shop Table
- `id`: UUID primary key
- `businessName`: Business name
- `address`: Business address
- `shopLogo`: Logo URL
- `shopBanner`: Banner URL
- `contactPhone`: Business phone
- `status`: Shop status
- `createdAt`: Creation timestamp
- `updatedAt`: Last modification timestamp

### OTP Table
- `id`: UUID primary key
- `email`: Email address
- `otp`: 6-digit code
- `expiresAt`: Expiration timestamp
- `used`: Boolean flag
- `createdAt`: Creation timestamp

## Error Handling

### Common Error Responses
```json
{
  "statusCode": 400,
  "message": "Invalid email or password",
  "error": "Bad Request"
}
```

### Error Codes
- `400`: Bad Request - Invalid input data
- `401`: Unauthorized - Invalid credentials or token
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - User not found
- `409`: Conflict - Email already exists
- `429`: Too Many Requests - Rate limit exceeded