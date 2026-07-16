# WelcomeFlow: Recruiting Assistant Project Instructions

## Product Identity

WelcomeFlow: Recruiting Assistant is a recruiter-first workflow assistant. It is not a full ATS. The purpose is to help recruiters move candidates faster through outreach, intake, submittal, interview, offer, onboarding, cleanup, and reporting.

## Core Rule

Do not destroy, rename, or restructure approved layouts unless explicitly asked. Changes should be additive and should preserve existing workflows, reports, saved data, mock/demo data, and existing navigation.

## Current Focus

Improve the Hot Leads and Add Candidate workflow by adding resume and application import automation. The goal is to reduce recruiter manual entry by pulling more usable data from resumes and using it to prefill the intake flow.

## Important Pages

1. Hot Leads
2. Add Candidate
3. Candidate Profile
4. Workspace
5. Weekly Cleanup
6. Reports
7. Automation Center
8. Settings

## Important UX Rules

1. Recruiters should be able to quickly add a lead or candidate while on the phone.
2. Resume upload should create a draft, not automatically finalize a candidate without recruiter review.
3. Autofilled fields should be visibly marked as extracted from resume, imported file, CSV, or recruiter edit.
4. Never overwrite recruiter-entered values unless the recruiter confirms.
5. Missing information should stay obvious in the readiness panel.
6. All major actions need history timestamps because recruiters must later update the ATS.
7. Reports and weekly cleanup must continue to receive candidate status, source, requisition, facility, and action history data.
8. Preserve the premium purple WelcomeFlow styling and the existing page layout unless the task specifically asks for a redesign.

## Data Integrity Rules

1. Candidate name, phone, email, source, requisition, facility, position, license, certifications, availability, compensation, and work history should feed into the same candidate data model used elsewhere.
2. Candidate history must track: resume imported, fields extracted, fields confirmed, fields manually edited, candidate created, outreach sent, interview scheduled, facility feedback requested, and ATS update generated.
3. Duplicate detection should check name, email, and phone before creating a new candidate.
4. Raw resume text should not be stored permanently unless the user explicitly confirms. Store parsed fields, filename, upload date, and extraction confidence instead.
5. Do not introduce a backend or paid third-party API unless explicitly requested. For now, build a front-end/local parsing workflow or a mock parser that can later be replaced by an API.

## Engineering Rules

1. Inspect the existing codebase first.
2. Identify the components, state shape, storage method, and data flow before editing.
3. Prefer clean, reusable helper functions and components.
4. Do not remove working functionality.
5. Do not leave unused imports or broken references.
6. Run the build before finishing.
7. Return a clear summary of files changed, behavior added, and any risks.
