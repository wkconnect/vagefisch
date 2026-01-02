# Vagefisch — Project Rules

**Version:** 1.0  
**Status:** Source of Truth  
**Last Updated:** 2026-01-02

---

## 1. Project Roles

### 1.1 Architect

The **Architect** is the final authority on all architectural decisions.

**Responsibilities:**

- Define and maintain system architecture
- Approve or reject architectural changes
- Review and accept Pull Requests
- Set priorities and task assignments
- Resolve technical disputes

**Authority:**

- All architectural decisions require Architect approval
- Non-Negotiables (see ARCHITECTURE.md §10) cannot be changed without Architect sign-off
- Architect can veto any PR that violates project principles

### 1.2 External Agents

**External Agents** (including AI assistants like Cursor, Manus, etc.) are implementers, not decision-makers.

**Responsibilities:**

- Implement assigned tasks according to specifications
- Follow project rules and architectural guidelines
- Create PRs with proper documentation
- Ask clarifying questions when requirements are unclear

**Limitations:**

- ❌ **Cannot** make architectural decisions
- ❌ **Cannot** simplify requirements without approval
- ❌ **Cannot** skip features "because it's faster"
- ❌ **Cannot** remove UI elements "because they're not needed yet"
- ❌ **Cannot** hide settings in config files

**Golden Rule:**

> If a curator (non-developer) cannot manage the system through the UI — the task is NOT complete.

---

## 2. Architectural Prohibitions

The following are **strictly prohibited** in this project:

### 2.1 No Scripts

Configuration and management must be done through the Web Admin Panel, not through scripts.

| ❌ Prohibited | ✅ Required |
|---------------|-------------|
| `./configure-scale.sh` | Web UI form for scale configuration |
| `python setup_printer.py` | Web UI form for printer setup |
| Manual JSON editing | Settings page in Web Admin Panel |

### 2.2 No Config-Only Settings

Every configurable parameter must be accessible through the Web Admin Panel.

| ❌ Prohibited | ✅ Required |
|---------------|-------------|
| Edit `config.yaml` to change OneBox URL | Settings → OneBox → Base URL field |
| Modify `.env` for Telegram token | Settings → Telegram → Bot Token field |
| Change timeout in source code | Settings → General → Timeout field |

### 2.3 No Single-Scale Assumptions

The system must always be designed for N scales, even if initially deployed with one.

| ❌ Prohibited | ✅ Required |
|---------------|-------------|
| `const scale = getScale()` | `const scales = getScales()` |
| Single scale configuration page | Scale list with add/edit/delete |
| Hardcoded scale IP | Scale table with IP per entry |

---

## 3. Git Workflow

### 3.1 Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/{short-description}` | `feature/scale-configuration-ui` |
| Fix | `fix/{short-description}` | `fix/printer-status-display` |
| Documentation | `docs/{short-description}` | `docs/source-of-truth` |
| Refactor | `refactor/{short-description}` | `refactor/queue-management` |

### 3.2 Commit Messages

Use conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples:**

```
feat(scales): add scale configuration form
fix(printers): correct status indicator color
docs(architecture): add multi-scale section
```

### 3.3 One Task = One PR

Each task results in exactly **one Pull Request**.

| ❌ Prohibited | ✅ Required |
|---------------|-------------|
| PR with 5 unrelated features | Separate PR for each feature |
| "WIP" PR with partial work | Complete PR with all requirements met |
| PR that "does everything" | Focused PR with clear scope |

---

## 4. Pull Request Requirements

Every PR **MUST** contain the following:

### 4.1 Description

Clear explanation of what was implemented:

```markdown
## Summary
Brief description of changes

## Changes
- Added X
- Modified Y
- Fixed Z

## Related Task
Task #N: [Task Title]
```

### 4.2 Screenshots (for UI changes)

| Requirement | Description |
|-------------|-------------|
| Before/After | Show state before and after changes |
| All affected screens | Include every modified UI element |
| Different states | Show loading, success, error states |

**PRs without screenshots for UI changes will be rejected.**

### 4.3 How to Test

Step-by-step instructions for verifying the changes:

```markdown
## How to Test

1. Start the application: `npm run dev`
2. Navigate to Settings → Scales
3. Click "Add Scale"
4. Fill in: Name="Test", IP="192.168.1.100", Port="4001"
5. Click "Save"
6. Verify scale appears in list
7. Click "Test Connection"
8. Verify status indicator shows result
```

### 4.4 Documentation Updates

If the PR changes UI behavior or adds features:

- Update relevant docs in `docs/` folder
- Update README.md if necessary
- Add inline code comments for complex logic

---

## 5. Definition of Done

A task is considered **DONE** only when:

### 5.1 Functionality

- [ ] All specified features are implemented
- [ ] No placeholder text or "TODO" comments in shipped code
- [ ] Error states are handled and displayed
- [ ] Loading states are implemented

### 5.2 User Experience

- [ ] Curator can complete the task without reading code
- [ ] All settings accessible via UI (no config files)
- [ ] UI is responsive and readable
- [ ] Error messages are human-readable

### 5.3 Code Quality

- [ ] No console errors or warnings
- [ ] Code follows project conventions
- [ ] No hardcoded values that should be configurable

### 5.4 Documentation

- [ ] PR description is complete
- [ ] Screenshots attached (for UI changes)
- [ ] How to Test section included
- [ ] Docs updated if behavior changed

### 5.5 Testing

- [ ] Manual testing completed
- [ ] All test cases from task pass
- [ ] Edge cases considered

---

## 6. Communication Rules

### 6.1 When in Doubt, Ask

If requirements are unclear:

1. **Do not** make assumptions
2. **Do not** simplify to "what makes sense"
3. **Do** ask the Architect for clarification

### 6.2 Blocking Issues

If you encounter a blocking issue:

1. Document the issue clearly
2. Explain what you tried
3. Propose alternatives (if any)
4. Wait for Architect decision

### 6.3 Scope Changes

If you believe the scope should change:

1. Complete the task as specified first
2. Document your suggestion separately
3. Let Architect decide on future changes

---

## 7. Quality Standards

### 7.1 UI Standards

| Aspect | Standard |
|--------|----------|
| Language | English (EN) for all UI text |
| Layout | Consistent spacing and alignment |
| Colors | Use design system colors only |
| Icons | Consistent icon family |
| Typography | Readable font sizes (min 14px) |

### 7.2 Code Standards

| Aspect | Standard |
|--------|----------|
| Formatting | Automated via Prettier/ESLint |
| Naming | Descriptive, English names |
| Comments | Explain "why", not "what" |
| Types | TypeScript strict mode |

### 7.3 Documentation Standards

| Aspect | Standard |
|--------|----------|
| Format | Markdown |
| Language | English |
| Structure | Clear headings and sections |
| Updates | Keep in sync with code |

---

## 8. Prohibited Practices

### 8.1 Development Shortcuts

- ❌ Skipping error handling "for now"
- ❌ Hardcoding values "temporarily"
- ❌ Leaving console.log statements
- ❌ Committing commented-out code

### 8.2 UX Shortcuts

- ❌ "Empty state" without explanation
- ❌ Technical error messages to users
- ❌ Missing loading indicators
- ❌ Buttons without feedback

### 8.3 Process Shortcuts

- ❌ Merging without review
- ❌ Skipping documentation
- ❌ "I'll fix it in the next PR"
- ❌ Combining unrelated changes

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-02 | Architecture Team | Initial release |
