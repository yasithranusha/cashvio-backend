# Encryption Configuration Guide

This document explains how to configure the encryption system for financial data in Cashvio.

## Environment Variables

Add these variables to your `.env` file:

```
# AWS KMS Configuration for Encryption (Optional)
# If not provided, local encryption fallback will be used
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_KMS_KEY_ID=your_kms_key_id
# OR
AWS_KMS_KEY_ALIAS=alias/your_kms_key_alias

# Transaction Timeouts
# Increase if you have many encryption operations in a transaction
PRISMA_TRANSACTION_TIMEOUT=30000
```

## Configuration Options

### AWS KMS (Recommended for Production)

For production environments, we strongly recommend using AWS KMS for encryption:

1. Create a KMS key in your AWS account
2. Configure the environment variables with your AWS credentials and KMS key information
3. Ensure your application has the necessary IAM permissions to use the KMS key

#### Important Notes on AWS KMS Configuration

- The KMS key alias should be prefixed with `alias/` (e.g., `alias/cashvio-kms`)
- The IAM user needs the following permissions:
  - `kms:Encrypt`
  - `kms:Decrypt`
  - `kms:DescribeKey`
- The KMS key must be in the same region specified in `AWS_REGION`

### Local Encryption Fallback

If AWS KMS is not configured or unavailable, the system will automatically fall back to local encryption:

- Uses AES-256-CBC encryption
- Generates random keys and initialization vectors for each value
- Stores the encrypted data with format: `fallback:{iv}:{key}:{encrypted}`

This fallback ensures the application continues to function even without AWS KMS, though with slightly reduced security.

## Transaction Timeout

Encryption and decryption operations can take time, especially when using AWS KMS. If you encounter transaction timeout errors, increase the `PRISMA_TRANSACTION_TIMEOUT` value.

The default timeout has been set to 30 seconds (30000ms), which should be sufficient for most operations.

## Troubleshooting

### Common Errors

1. **"UnrecognizedClientException: The security token included in the request is invalid"**

   - Your AWS credentials are invalid or expired
   - The IAM user doesn't have sufficient permissions
   - Solution: Update your AWS credentials or check IAM permissions

2. **"Transaction already closed"**

   - The transaction is taking too long due to encryption operations
   - Solution: Increase the `PRISMA_TRANSACTION_TIMEOUT` value

3. **"Failed to initialize AWS KMS client"**
   - AWS SDK cannot initialize with the provided credentials
   - Solution: Check your AWS configuration or switch to local encryption

### Debugging Steps

If you're having issues with AWS KMS:

1. **Check Environment Variables**

   - Make sure all AWS environment variables are properly set in your `.env` file
   - Verify the application is loading the `.env` file correctly

2. **Verify KMS Key Format**

   - If using a KMS key alias, make sure it's prefixed with `alias/`
   - Example: `AWS_KMS_KEY_ALIAS=alias/cashvio-kms`

3. **Test IAM Permissions**

   - Use the AWS CLI to test encryption with the same credentials:
     ```
     aws kms encrypt --key-id alias/your-key-alias --plaintext "test" --output text --query CiphertextBlob
     ```

4. **Check Region**

   - Ensure the KMS key is in the same region specified in `AWS_REGION`

5. **Docker Environment**
   - If running in Docker, make sure environment variables are properly passed to the container

The application will automatically fall back to local encryption if AWS KMS is not available or properly configured.
