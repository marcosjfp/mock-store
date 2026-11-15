import { Check, CircleAlert, Minus, UserPlus } from "lucide-react";
import { FormEvent, useState } from "react";

import { Member, Role } from "../api/client";
import { ROLE_DESCRIPTIONS, canManageTeam, formatRoleLabel } from "../auth/roles";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { Drawer } from "../components/ui/Overlay";
import { Avatar, Badge, RoleBadge, Skeleton } from "../components/ui/primitives";
import { useToast } from "../components/ui/Toast";
import { useSession } from "../context/AuthContext";
import { useCreateMember, useMe, useMembers, useUpdateMember } from "../hooks/queries";
import { PageHeader, QueryError } from "../layout/PageHeader";
import { displayName, formatDate, pluralize } from "../lib/format";

const PERMISSIONS: Array<{ label: string; roles: Role[] }> = [
  { label: "View catalog, stock and orders", roles: ["owner", "manager", "staff"] },
  { label: "Place and fulfil orders", roles: ["owner", "manager", "staff"] },
  { label: "Edit products and adjust stock", roles: ["owner", "manager"] },
  { label: "Cancel orders", roles: ["owner", "manager"] },
  { label: "View team and activity log", roles: ["owner", "manager"] },
  { label: "Invite, promote and deactivate members", roles: ["owner"] },
];
const ROLES: Role[] = ["owner", "manager", "staff"];

function InviteDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateMember();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "staff">("staff");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFullName("");
    setEmail("");
    setRole("staff");
    setPassword("");
    setError(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    create.mutate(
      { email: email.trim(), password, role, full_name: fullName.trim() || null },
      {
        onSuccess: (member) => {
          toast.success(`${displayName(member.full_name, member.email)} added as ${formatRoleLabel(member.role).toLowerCase()}`);
          reset();
          onClose();
        },
        onError: (failure) => setError(failure.message),
      },
    );
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Add team member"
      description="They sign in with the workspace ID, this email and the temporary password."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="invite-form" variant="primary" loading={create.isPending}>
            Add member
          </Button>
        </>
      }
    >
      <form id="invite-form" className="form-grid" onSubmit={handleSubmit}>
        {error && (
          <div className="callout" data-tone="critical" role="alert">
            <CircleAlert />
            <span>{error}</span>
          </div>
        )}
        <Field label="Full name">
          {(control) => (
            <input {...control} className="input" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={120} autoFocus />
          )}
        </Field>
        <Field label="Email">
          {(control) => (
            <input {...control} className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          )}
        </Field>
        <fieldset className="role-picker">
          <legend className="field-label">Role</legend>
          {(["staff", "manager"] as const).map((option) => (
            <label key={option} data-checked={role === option || undefined}>
              <input type="radio" name="role" value={option} checked={role === option} onChange={() => setRole(option)} />
              <span>
                <strong>{formatRoleLabel(option)}</strong>
                <span>{ROLE_DESCRIPTIONS[option]}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Field label="Temporary password" hint="At least 8 characters. Share it with them securely.">
          {(control) => (
            <input
              {...control}
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          )}
        </Field>
      </form>
    </Drawer>
  );
}

export default function TeamPage() {
  const { role } = useSession();
  const canManage = canManageTeam(role);
  const me = useMe();
  const members = useMembers();
  const update = useUpdateMember();
  const toast = useToast();
  const [inviting, setInviting] = useState(false);

  function change(member: Member, payload: { role?: "manager" | "staff"; is_active?: boolean }, message: string) {
    update.mutate(
      { id: member.id, ...payload },
      {
        onSuccess: () => toast.success(message),
        onError: (failure) => toast.error(failure.message),
      },
    );
  }

  const list = members.data ?? [];
  const active = list.filter((member) => member.is_active).length;

  return (
    <>
      <PageHeader
        title="Team"
        description={members.data ? `${pluralize(active, "active member")} in this workspace` : "Who can access this workspace"}
        actions={
          canManage && (
            <Button variant="primary" icon={<UserPlus />} onClick={() => setInviting(true)}>
              Add member
            </Button>
          )
        }
      />

      {members.isError ? (
        <QueryError error={members.error} onRetry={() => void members.refetch()} />
      ) : (
        <div className="team-grid">
          <section className="card">
            {members.isPending ? (
              <div className="skeleton-stack" style={{ padding: "1rem" }}>
                {[0, 1, 2, 3].map((index) => (
                  <Skeleton key={index} height={44} />
                ))}
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Joined</th>
                      {canManage && (
                        <th>
                          <span className="sr-only">Actions</span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((member) => {
                      const isSelf = member.id === me.data?.id;
                      const editable = canManage && member.role !== "owner" && !isSelf;
                      return (
                        <tr key={member.id} data-inactive={!member.is_active || undefined}>
                          <td>
                            <div className="person-cell">
                              <Avatar name={member.full_name} email={member.email} />
                              <div style={{ minWidth: 0 }}>
                                <strong className="truncate">
                                  {displayName(member.full_name, member.email)}
                                  {isSelf && <span className="muted"> (you)</span>}
                                </strong>
                                <span className="muted truncate">{member.email}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            {editable && member.is_active ? (
                              <select
                                className="select select-sm"
                                aria-label={`Role for ${displayName(member.full_name, member.email)}`}
                                value={member.role}
                                disabled={update.isPending}
                                onChange={(event) => {
                                  const next = event.target.value as "manager" | "staff";
                                  change(member, { role: next }, `${displayName(member.full_name, member.email)} is now ${formatRoleLabel(next).toLowerCase()}`);
                                }}
                              >
                                <option value="manager">Manager</option>
                                <option value="staff">Staff</option>
                              </select>
                            ) : (
                              <RoleBadge role={member.role} />
                            )}
                          </td>
                          <td>{member.is_active ? <Badge tone="good">Active</Badge> : <Badge>Deactivated</Badge>}</td>
                          <td className="secondary">{formatDate(member.created_at)}</td>
                          {canManage && (
                            <td className="align-right">
                              {editable && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={update.isPending}
                                  onClick={() =>
                                    change(
                                      member,
                                      { is_active: !member.is_active },
                                      `${displayName(member.full_name, member.email)} ${member.is_active ? "deactivated" : "reactivated"}`,
                                    )
                                  }
                                >
                                  {member.is_active ? "Deactivate" : "Reactivate"}
                                </Button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <header className="card-header">
              <div>
                <h2 className="card-title">What each role can do</h2>
                <p className="card-subtitle">Enforced by the API on every request, not just hidden in the UI.</p>
              </div>
            </header>
            <div className="card-body">
              <table className="matrix">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="sr-only">Permission</span>
                    </th>
                    {ROLES.map((name) => (
                      <th key={name} scope="col" data-current={name === role || undefined}>
                        {formatRoleLabel(name)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS.map((permission) => (
                    <tr key={permission.label}>
                      <th scope="row">{permission.label}</th>
                      {ROLES.map((name) => {
                        const allowed = permission.roles.includes(name);
                        return (
                          <td key={name} data-allowed={allowed || undefined} data-current={name === role || undefined}>
                            {allowed ? <Check aria-label="Allowed" /> : <Minus aria-label="Not allowed" />}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {canManage && <InviteDrawer open={inviting} onClose={() => setInviting(false)} />}
    </>
  );
}
