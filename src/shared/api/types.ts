export type FieldViolation = { field: string; message: string };

export type ErrorResponse = {
  code: string;
  message: string;
  status: number;
  traceId?: string;
  details?: FieldViolation[];
};
