export interface EmployeeRecord {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  basicSalary: number;
  housing: number;
  transport: number;
  otherAllowances: number;
  isActive: boolean;
  taxId?: string;
  bankName?: string;
  accountNumber?: string;
  department?: string;
  hireDate?: string;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACTOR";
}
