# Financial Data Encryption in Cashvio

This document provides details about the encryption implementation for financial data in the Cashvio backend application.

## Overview

Sensitive financial data in Cashvio is encrypted before being stored in the database to enhance security and protect customer information. The encryption is implemented using AWS KMS (Key Management Service) with a fallback mechanism for situations where KMS might be unavailable.

## Encrypted Data

The following financial data is encrypted:

- **ShopBalance**

  - cashBalance
  - cardBalance
  - bankBalance

- **CustomerWallet**

  - balance
  - loyaltyPoints

- **Order**

  - subtotal
  - discount
  - total
  - paid
  - paymentDue

- **OrderItem**

  - originalPrice
  - sellingPrice

- **Payment**

  - amount

- **Item**
  - broughtPrice
  - sellPrice

## Implementation Details

### Database Schema

All financial fields have been changed from numeric types (Float/Int) to String types in the Prisma schema to store encrypted values.

### Encryption Process

1. **Encryption**: Financial data is encrypted before being stored in the database:

   - Primary encryption uses AWS KMS
   - Fallback encryption uses AES-256-CBC with randomly generated keys

2. **Decryption**: Data is decrypted when read from the database for processing:

   - Automatic decryption in service methods
   - Parsed back to numeric types for calculations

3. **Re-encryption**: After calculations, data is re-encrypted before being stored back in the database

### Code Structure

The encryption implementation is primarily in the `OrderService` class:

- `encrypt(text: string)`: Encrypts a string value
- `decrypt(encryptedText: string)`: Decrypts an encrypted string
- `prepareOrderData(order: any)`: Prepares order data with encryption
- `prepareOrderItemData(item: any)`: Prepares order item data with encryption
- `preparePaymentData(payment: any)`: Prepares payment data with encryption
- `decryptOrderData(order: any)`: Decrypts order financial fields
- `decryptOrderItemData(item: any)`: Decrypts order item financial fields
- `decryptPaymentData(payment: any)`: Decrypts payment financial fields

## AWS KMS Configuration

The encryption system relies on the following environment variables:

```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_KMS_KEY_ID=your_key_id
AWS_KMS_KEY_ALIAS=your_key_alias
```

Either `AWS_KMS_KEY_ID` or `AWS_KMS_KEY_ALIAS` must be provided for AWS KMS encryption to work.

## Fallback Mechanism

If AWS KMS is unavailable or not configured, the system falls back to local encryption:

1. A random 256-bit key and 128-bit initialization vector are generated
2. AES-256-CBC encryption is used
3. The encrypted data is stored with the format: `fallback:{iv}:{key}:{encrypted_data}`

This ensures the system can continue to function even if AWS KMS is temporarily unavailable, though with a slightly reduced security level.

## Security Considerations

1. **Data at Rest**: Financial data is encrypted in the database
2. **Data in Transit**: Ensure HTTPS is used for all API endpoints
3. **Key Management**: Regularly rotate AWS KMS keys
4. **Access Control**: Limit access to AWS KMS keys
5. **Audit Trail**: Enable AWS CloudTrail for KMS key usage auditing

## Testing

A test script is available at `apps/order/src/scripts/test-encryption.ts` to verify the encryption implementation.

## Troubleshooting

### Common Issues

1. **Decryption Failures**: Check that the AWS KMS key used for encryption is still active and accessible
2. **Type Errors**: Ensure all financial values are properly parsed to numbers after decryption
3. **Performance Issues**: If encryption/decryption is causing performance problems, consider implementing caching for frequently accessed data

### Logging

Encryption and decryption operations are logged (without sensitive data) to help with troubleshooting:

- Success logs are at DEBUG level
- Error logs are at ERROR level

## Future Improvements

1. **Key Rotation**: Implement automatic key rotation
2. **Performance Optimization**: Batch encryption/decryption operations
3. **Caching**: Implement caching for frequently accessed encrypted data
4. **Field-level Encryption**: Consider more granular encryption policies
