export interface UniversityFaculty {
  id: string;
  name: string;
  code: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UniversityDepartment {
  id: string;
  name: string;
  code: string;
  facultyId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UniversityProgramme {
  id: string;
  name: string;
  code: string;
  degreeType: "UG" | "PG" | "INTEGRATED";
  durationYears: number;
  totalSemesters: number;
  departmentId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UniversityBatch {
  id: string;
  year: string;
  programmeId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UniversitySection {
  id: string;
  label: string;
  academicBatchId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UniversityAcademicSession {
  id: string;
  startYear: number;
  endYear: number;
  status: "PLANNING" | "ACTIVE" | "ARCHIVED";
  label: string;
  createdAt?: Date;
  updatedAt?: Date;
}
