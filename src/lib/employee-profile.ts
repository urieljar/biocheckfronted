export const EMPTY_EMPLOYEE_PROFILE = {
  firstName: '', lastName: '', employeeNumber: '', departmentId: '', positionId: '', areaId: '',
  employmentType: '', hireDate: '', employmentStatus: '', terminationDate: '', terminationReason: '',
  phone: '', officePhone: '', mobilePhone: '', email: '', address: '', city: '', postalCode: '',
  nationalId: '', socialSecurityNumber: '', birthDate: '', passportNumber: '',
  driverLicenseVehicle: '', driverLicenseMotorcycle: '',
}
export type EmployeeProfileData = typeof EMPTY_EMPLOYEE_PROFILE & { id?: string; employeeId?: string }
