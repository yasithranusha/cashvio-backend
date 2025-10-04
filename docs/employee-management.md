# Employee Management API

## Overview

The Employee Management API provides comprehensive functionality for managing employee records within shops in the Cashvio platform. It allows shop owners and administrators to track employee information, including designation, salary, hire dates, and employment status.

## Features

- ✅ Create employee records with detailed information
- ✅ Retrieve employee information with pagination and filtering
- ✅ Update employee details including salary, designation, and status
- ✅ Delete employee records
- ✅ Track employee status (Active, On Leave, Suspended, Terminated)
- ✅ Department-based organization
- ✅ Emergency contact information
- ✅ Shop-based employee counts
- ✅ Role-based access control

## Database Schema

### Employee Model

```prisma
model Employee {
  id               String         @id @default(uuid())
  userId           String         @map("user_id")
  shopId           String         @map("shop_id")
  designation      String
  department       String?
  salary           String         // Stored as string for precise decimal handling
  hireDate         DateTime       @map("hire_date")
  status           EmployeeStatus @default(ACTIVE)
  emergencyContact String?        @map("emergency_contact")
  address          String?
  notes            String?
  createdAt        DateTime       @default(now()) @map("created_at")
  updatedAt        DateTime       @updatedAt @map("updated_at")
  user             User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  shop             Shop           @relation(fields: [shopId], references: [id], onDelete: Cascade)

  @@unique([userId, shopId])
  @@index([userId])
  @@index([shopId])
  @@map("employees")
}
```

### Employee Status Enum

```prisma
enum EmployeeStatus {
  ACTIVE      // Currently working
  ON_LEAVE    // Temporarily away
  SUSPENDED   // Temporarily suspended
  TERMINATED  // Employment ended
}
```

## API Endpoints

### 1. Create Employee

**POST** `/employees`

Creates a new employee record for a user in a specific shop.

**Authorization:** SHOP_OWNER, ADMIN, SUPER_ADMIN

**Request Body:**

```json
{
  "userId": "uuid",
  "shopId": "uuid",
  "designation": "Sales Manager",
  "department": "Sales",
  "salary": "50000.00",
  "hireDate": "2024-01-15T00:00:00.000Z",
  "emergencyContact": "+1234567890",
  "address": "123 Main St, City, State",
  "notes": "Experienced in retail management"
}
```

**Response:**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "shopId": "uuid",
  "designation": "Sales Manager",
  "department": "Sales",
  "salary": "50000.00",
  "hireDate": "2024-01-15T00:00:00.000Z",
  "status": "ACTIVE",
  "emergencyContact": "+1234567890",
  "address": "123 Main St, City, State",
  "notes": "Experienced in retail management",
  "createdAt": "2024-10-05T10:00:00.000Z",
  "updatedAt": "2024-10-05T10:00:00.000Z",
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "contactNumber": "+1234567890",
    "profileImage": "https://..."
  },
  "shop": {
    "id": "uuid",
    "businessName": "Tech Store"
  }
}
```

### 2. Get All Employees

**GET** `/employees?page=1&limit=10&shopId=uuid&status=ACTIVE&department=Sales&search=john`

Retrieves a paginated list of employees with optional filtering.

**Authorization:** SHOP_OWNER, ADMIN, SUPER_ADMIN, SHOP_STAFF

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `shopId` (optional): Filter by shop ID
- `status` (optional): Filter by employee status
- `department` (optional): Filter by department
- `search` (optional): Search by employee name or email

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "shopId": "uuid",
      "designation": "Sales Manager",
      "department": "Sales",
      "salary": "50000.00",
      "hireDate": "2024-01-15T00:00:00.000Z",
      "status": "ACTIVE",
      "createdAt": "2024-10-05T10:00:00.000Z",
      "updatedAt": "2024-10-05T10:00:00.000Z",
      "user": {
        "id": "uuid",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "shop": {
        "id": "uuid",
        "businessName": "Tech Store"
      }
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

### 3. Get Employee by ID

**GET** `/employees/:id`

Retrieves detailed information about a specific employee.

**Authorization:** SHOP_OWNER, ADMIN, SUPER_ADMIN, SHOP_STAFF

**Response:** Same as create employee response

### 4. Get Employee by User ID and Shop ID

**GET** `/employees/user/:userId/shop/:shopId`

Retrieves employee information for a specific user in a specific shop.

**Authorization:** SHOP_OWNER, ADMIN, SUPER_ADMIN, SHOP_STAFF

**Response:** Same as create employee response

### 5. Update Employee

**PUT** `/employees/:id`

Updates an existing employee record.

**Authorization:** SHOP_OWNER, ADMIN, SUPER_ADMIN

**Request Body (all fields optional):**

```json
{
  "designation": "Senior Sales Manager",
  "department": "Sales",
  "salary": "60000.00",
  "hireDate": "2024-01-15T00:00:00.000Z",
  "status": "ACTIVE",
  "emergencyContact": "+1234567890",
  "address": "456 Oak Ave, City, State",
  "notes": "Promoted to senior position"
}
```

**Response:** Same as create employee response

### 6. Delete Employee

**DELETE** `/employees/:id`

Deletes an employee record from the system.

**Authorization:** SHOP_OWNER, ADMIN, SUPER_ADMIN

**Response:** Deleted employee object

### 7. Get Shop Employee Count

**GET** `/employees/shop/:shopId/count`

Returns the number of active employees in a specific shop.

**Authorization:** SHOP_OWNER, ADMIN, SUPER_ADMIN

**Response:**

```json
{
  "count": 15
}
```

## Usage Examples

### Creating an Employee

```bash
curl -X POST http://localhost:8080/employees \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "123e4567-e89b-12d3-a456-426614174000",
    "shopId": "123e4567-e89b-12d3-a456-426614174001",
    "designation": "Cashier",
    "department": "Front Office",
    "salary": "30000.00",
    "hireDate": "2024-10-01T00:00:00.000Z",
    "emergencyContact": "+1234567890"
  }'
```

### Getting Employees with Filters

```bash
curl -X GET "http://localhost:8080/employees?shopId=123e4567-e89b-12d3-a456-426614174001&status=ACTIVE&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Updating Employee Status

```bash
curl -X PUT http://localhost:8080/employees/123e4567-e89b-12d3-a456-426614174002 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "ON_LEAVE"
  }'
```

## Database Migration

To apply the employee management schema to your database, run:

```bash
npx prisma migrate dev --name add_employee_management
```

After migration, regenerate the Prisma client:

```bash
npx prisma generate
```

## Access Control

The employee management endpoints use role-based access control:

| Endpoint           | SHOP_OWNER | ADMIN | SUPER_ADMIN | SHOP_STAFF |
| ------------------ | ---------- | ----- | ----------- | ---------- |
| Create Employee    | ✅         | ✅    | ✅          | ❌         |
| Get Employees      | ✅         | ✅    | ✅          | ✅         |
| Get Employee by ID | ✅         | ✅    | ✅          | ✅         |
| Update Employee    | ✅         | ✅    | ✅          | ❌         |
| Delete Employee    | ✅         | ✅    | ✅          | ❌         |
| Get Employee Count | ✅         | ✅    | ✅          | ❌         |

## Error Handling

The API returns appropriate HTTP status codes:

- `200 OK` - Successful operation
- `201 Created` - Employee created successfully
- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Employee, user, or shop not found
- `409 Conflict` - Employee record already exists
- `500 Internal Server Error` - Server error

## Best Practices

1. **Salary Storage**: Salaries are stored as strings to maintain precision with decimal values.
2. **User-Shop Relationship**: Each user can only have one employee record per shop (enforced by unique constraint).
3. **Cascading Deletes**: Deleting a user or shop will automatically delete associated employee records.
4. **Status Tracking**: Use appropriate status values to track employee lifecycle.
5. **Emergency Contacts**: Always collect and keep emergency contact information up to date.
6. **Department Organization**: Use consistent department names across the organization.

## Future Enhancements

Potential features for future releases:

- [ ] Employee attendance tracking
- [ ] Payroll management integration
- [ ] Performance review system
- [ ] Leave request management
- [ ] Shift scheduling
- [ ] Employee document storage
- [ ] Salary history tracking
- [ ] Employee analytics and reports

## Related Modules

- **Users Module**: Manages user accounts
- **Shop Module**: Manages shop information
- **Auth Module**: Handles authentication and authorization

## Support

For issues or questions related to employee management:

- Create an issue on GitHub
- Contact the development team
- Refer to the main documentation
