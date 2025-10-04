# Mailer-Uploader Service

## Overview

The Mailer-Uploader Service handles email notifications and file uploads to AWS S3 for the Cashvio platform. It provides centralized email functionality and secure file storage with organized folder structures.

## Key Features

- **Email Notifications**: Send transactional emails via Gmail OAuth
- **File Upload Management**: Upload files to AWS S3 with organized folder structure
- **File Deletion**: Remove files from S3 using file keys
- **Multiple File Support**: Batch upload and delete operations
- **Folder Organization**: Optional subfolder structure for better file organization
- **Receipt Emails**: Integration with Order Service for automatic receipt sending

## Endpoints

### File Upload Management

#### POST /upload
Upload files to AWS S3 bucket.

**Request Type**: `multipart/form-data`

**Form Fields:**
- `files`: File(s) to upload (supports multiple files)

**Query Parameters:**
- `subFolder`: Optional subfolder path (e.g., "electronics/smartphones")

**Example Request:**
```bash
curl -X POST http://localhost:8081/upload?subFolder=electronics/smartphones \
  -F "files=@image1.jpg" \
  -F "files=@image2.jpg"
```

**Response:**
```json
{
  "message": "Files uploaded successfully",
  "files": [
    {
      "originalName": "image1.jpg",
      "s3Key": "images/electronics/smartphones/1743238430030-image1-bcbdc1e1-63cc-40b8-8020-2244a793ac94.jpg",
      "url": "https://your-bucket.s3.eu-north-1.amazonaws.com/images/electronics/smartphones/1743238430030-image1-bcbdc1e1-63cc-40b8-8020-2244a793ac94.jpg",
      "size": 245760
    },
    {
      "originalName": "image2.jpg",
      "s3Key": "images/electronics/smartphones/1743238430031-image2-dcbdc1e1-63cc-40b8-8020-2244a793ac95.jpg",
      "url": "https://your-bucket.s3.eu-north-1.amazonaws.com/images/electronics/smartphones/1743238430031-image2-dcbdc1e1-63cc-40b8-8020-2244a793ac95.jpg",
      "size": 189440
    }
  ]
}
```

#### DELETE /upload
Delete files from AWS S3 bucket.

**Request:**
```json
{
  "key": [
    "images/electronics/smartphones/1743238430030-image1-bcbdc1e1-63cc-40b8-8020-2244a793ac94.jpg",
    "images/electronics/smartphones/1743238430031-image2-dcbdc1e1-63cc-40b8-8020-2244a793ac95.jpg"
  ]
}
```

**Note**: The `key` field can accept either a single string or an array of strings.

**Response:**
```json
{
  "message": "Files deleted successfully",
  "deletedFiles": [
    "images/electronics/smartphones/1743238430030-image1-bcbdc1e1-63cc-40b8-8020-2244a793ac94.jpg",
    "images/electronics/smartphones/1743238430031-image2-dcbdc1e1-63cc-40b8-8020-2244a793ac95.jpg"
  ]
}
```

### Email Services

#### POST /mail/send
Send email notifications.

**Request:**
```json
{
  "to": "customer@example.com",
  "subject": "Order Receipt - ORD-2025-001",
  "html": "<h1>Thank you for your order!</h1><p>Order details...</p>",
  "text": "Thank you for your order! Order details...",
  "attachments": [
    {
      "filename": "receipt.pdf",
      "content": "base64-encoded-content",
      "contentType": "application/pdf"
    }
  ]
}
```

**Response:**
```json
{
  "message": "Email sent successfully",
  "messageId": "gmail-message-id-here"
}
```

## File Management Features

### Automatic File Naming
- Files are automatically renamed with timestamp and UUID for uniqueness
- Format: `{timestamp}-{originalName}-{uuid}.{extension}`
- Prevents file name conflicts and provides traceability

### Folder Structure
- Base folder: `images/`
- Optional subfolders: `images/{subFolder}/`
- Example: `images/electronics/smartphones/`
- Supports nested folder structures for better organization

### Supported File Types
- **Images**: JPG, JPEG, PNG, GIF, WebP
- **Documents**: PDF, DOC, DOCX
- **Spreadsheets**: XLS, XLSX, CSV
- **Other**: Configurable based on business needs

### File Size Limits
- Maximum single file size: 10MB (configurable)
- Maximum total upload size per request: 50MB
- Automatic compression for images over 2MB

## Email Integration

### Gmail OAuth Configuration
- Separate OAuth app from user authentication
- Dedicated service account for sending emails
- Refresh token management for continuous operation

### Email Templates
- HTML and plain text support
- Dynamic content injection
- Attachment support for receipts and documents

### Transactional Email Types
- **Order Receipts**: Sent automatically when orders are completed
- **OTP Verification**: Account registration and password reset
- **Notifications**: System alerts and updates
- **Marketing**: Promotional emails (future feature)

## Integration with Other Services

### Order Service Integration
- Automatic receipt email generation
- Order details formatting
- Customer information retrieval
- Payment confirmation emails

### Auth Service Integration
- OTP email delivery
- Account verification emails
- Password reset notifications

### RabbitMQ Message Handling
- Asynchronous email processing
- Message queuing for high-volume scenarios
- Retry mechanisms for failed deliveries

## Configuration

### Environment Variables
```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET=your-s3-bucket-name
AWS_REGION=eu-north-1

# Gmail OAuth Configuration
GMAIL_CLIENT_ID=your-gmail-client-id
GMAIL_CLIENT_SECRET=your-gmail-client-secret
GMAIL_REFRESH_TOKEN=your-gmail-refresh-token
GMAIL_USER_EMAIL=your-email@gmail.com

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672

# Service Configuration
MAILER_UPLOADER_SERVICE_PORT=8081
MAX_FILE_SIZE=10485760  # 10MB in bytes
MAX_TOTAL_SIZE=52428800  # 50MB in bytes

# File Upload Settings
ALLOWED_FILE_TYPES=jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,csv
ENABLE_IMAGE_COMPRESSION=true
COMPRESSION_QUALITY=80
```

### AWS S3 Permissions
Required S3 bucket permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name",
        "arn:aws:s3:::your-bucket-name/*"
      ]
    }
  ]
}
```

## Data Models

### UploadResponse Model
```typescript
{
  message: string;
  files: {
    originalName: string;
    s3Key: string;
    url: string;
    size: number;
  }[];
}
```

### EmailRequest Model
```typescript
{
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: {
    filename: string;
    content: string; // Base64 encoded
    contentType: string;
  }[];
}
```

### DeleteRequest Model
```typescript
{
  key: string | string[];
}
```

## Error Handling

### File Upload Errors
- `400`: Invalid file type or size exceeded
- `413`: Payload too large
- `500`: AWS S3 upload failure
- `507`: Storage quota exceeded

### Email Errors
- `400`: Invalid email format or missing required fields
- `401`: Gmail authentication failure
- `429`: Rate limit exceeded
- `500`: Email service unavailable

### Common Error Response
```json
{
  "statusCode": 400,
  "message": "File type not allowed. Allowed types: jpg, jpeg, png, gif, webp, pdf",
  "error": "Bad Request"
}
```

## Security Features

### File Upload Security
- File type validation based on content, not just extension
- Virus scanning integration (configurable)
- Size limits to prevent abuse
- Unique file naming to prevent conflicts

### Email Security
- OAuth 2.0 authentication with Gmail
- Rate limiting to prevent spam
- Input sanitization for email content
- Blacklist/whitelist support for email addresses

### Access Control
- JWT authentication required for all endpoints
- Role-based access for sensitive operations
- IP whitelisting for production environments

## Performance Optimization

### File Upload Optimization
- Streaming uploads for large files
- Parallel processing for multiple files
- Automatic image compression
- CDN integration for file delivery

### Email Performance
- Message queuing for bulk emails
- Template caching for faster rendering
- Connection pooling for SMTP
- Retry mechanisms with exponential backoff

## Monitoring & Logging

### File Operations Logging
- Upload success/failure rates
- File size and type analytics
- Storage usage tracking
- Download frequency metrics

### Email Delivery Tracking
- Delivery success rates
- Bounce and complaint handling
- Send volume monitoring
- Performance metrics

### Health Checks
- AWS S3 connectivity
- Gmail API availability
- RabbitMQ connection status
- Disk space monitoring