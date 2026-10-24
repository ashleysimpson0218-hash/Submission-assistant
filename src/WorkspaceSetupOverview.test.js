import { fireEvent, render, screen, within } from "@testing-library/react";
import { WorkspaceSetupOverview } from "./WorkspaceSetupOverview";
import { workspaceSaveStatus } from "./industryProfiles";

const theme = { panel: "#fff", panelAlt: "#fafafa", border: "#ddd", text: "#111", muted: "#555", primary2: "#6d28d9" };
const settingsWithBasics = () => ({
  general: { companyName: "Synthetic Company", recruiterName: "Example Recruiter", recruiterEmail: "recruiter@example.test" },
  sites: [{ id: "site-1", siteName: "Synthetic Office", hiringManagerEmail: "manager@example.test", status: "Inactive" }],
  roles: [{ id: "role-1", positionTitle: "Office Coordinator", status: "Active" }],
  requisitions: [{ id: "opening-1", reqNumber: "SYN-100", positionTitle: "Office Coordinator", siteName: "Synthetic Office", status: "Active" }],
});

test("the primary setup action advances from the missing basics and optional settings stay separate", () => {
  const settings = settingsWithBasics();
  settings.requisitions = [];
  const before = JSON.stringify(settings);
  const onOpenSection = jest.fn();
  const { rerender } = render(<WorkspaceSetupOverview settings={settings} theme={theme} onOpenSection={onOpenSection} />);

  expect(screen.getByText("3 of 4 basics have information")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Add job openings" }));
  expect(onOpenSection).toHaveBeenLastCalledWith("requisitions");
  expect(JSON.stringify(settings)).toBe(before);

  rerender(<WorkspaceSetupOverview settings={settingsWithBasics()} theme={theme} onOpenSection={onOpenSection} />);
  expect(screen.getByText("4 of 4 basics have information")).toBeVisible();
  expect(screen.getByText(/Account access and communication settings still need their own checks/)).toBeVisible();
  expect(screen.queryByText(/ready to launch|setup complete/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Review job openings" }));
  expect(onOpenSection).toHaveBeenLastCalledWith("requisitions");

  const optional = screen.getByText("Optional settings").closest("details");
  expect(optional).not.toHaveAttribute("open");
  fireEvent.click(screen.getByText("Optional settings"));
  fireEvent.click(within(optional).getByRole("button", { name: "Open follow-up timing" }));
  expect(onOpenSection).toHaveBeenLastCalledWith("workflow");
  expect(screen.getByText("4 of 4 basics have information")).toBeVisible();
});

test.each([
  [{}, "Session only", "Changes last for this session. Workspace saving is disabled."],
  [{ cloudEnabled: true, cloudStatus: "Cloud save failed. Please reconnect." }, "Save needs attention", "Cloud save failed. Please reconnect."],
  [{ cloudEnabled: true, cloudStatus: "Saving to cloud…" }, "Saving / loading", "Saving to cloud…"],
  [{ cloudEnabled: true, cloudStatus: "Saved to cloud" }, "Cloud connected", "Saved to cloud"],
])("setup displays the reported saving state without inventing a save action: %p", (input, label, detail) => {
  render(<WorkspaceSetupOverview settings={{}} theme={theme} saveStatus={workspaceSaveStatus(input)} onOpenSection={jest.fn()} />);
  const saving = within(screen.getByRole("region", { name: "Workspace saving" }));
  expect(saving.getByText(`Latest saving status: ${label}`)).toBeVisible();
  expect(saving.getByText(detail)).toBeVisible();
  expect(saving.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.queryByText(/all changes saved/i)).not.toBeInTheDocument();
});
