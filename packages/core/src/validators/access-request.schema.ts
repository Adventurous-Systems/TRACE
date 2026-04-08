import { z } from 'zod';

export const AccessRequestRoleSchema = z.enum(['hub_staff', 'hub_admin']);
export const AccessRequestStatusSchema = z.enum(['pending', 'approved', 'rejected']);

export const CreateAccessRequestSchema = z.object({
  requestedRole: AccessRequestRoleSchema,
  organisationName: z.string().min(1).max(255),
  notes: z.string().max(1000).optional(),
});

export type CreateAccessRequestInput = z.infer<typeof CreateAccessRequestSchema>;

export const AccessRequestQuerySchema = z.object({
  status: AccessRequestStatusSchema.optional(),
});

export type AccessRequestQueryInput = z.infer<typeof AccessRequestQuerySchema>;

export const ApproveAccessRequestSchema = z.object({
  role: AccessRequestRoleSchema,
  organisationId: z.string().uuid(),
  reviewNotes: z.string().max(1000).optional(),
});

export type ApproveAccessRequestInput = z.infer<typeof ApproveAccessRequestSchema>;

export const RejectAccessRequestSchema = z.object({
  reviewNotes: z.string().max(1000).optional(),
});

export type RejectAccessRequestInput = z.infer<typeof RejectAccessRequestSchema>;
