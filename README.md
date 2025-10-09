# Enterprise User Report Pipeline 📊

This repository contains an automated GitHub Actions pipeline that generates nightly reports of all users across GitHub Enterprise Cloud organizations. The pipeline creates detailed issues with user counts and comprehensive user information for management review.

## 🚀 Features

- **Automated Scheduling**: Runs every night at 2 AM UTC
- **Manual Triggering**: Can be triggered manually via GitHub Actions UI
- **Comprehensive Reporting**: Provides both summary tables and detailed user information including:
  - Organization members with their roles
  - Outside collaborators with repository access
  - Distinction between different user types for license tracking
- **Sorted Output**: Organizations and users are alphabetically sorted for easy navigation
- **Error Handling**: Pipeline fails fast if any issues occur during data collection
- **Enterprise API Integration**: Uses GitHub Enterprise Cloud REST APIs

## 📋 Requirements

### Personal Access Token (PAT)

The pipeline requires a GitHub Personal Access Token with **full enterprise access**. The PAT must have the following scopes:

#### Required Scopes

- `admin:org` - Full control of organizations and teams, read and write org projects
- `read:user` - Read all user profile data  
- `user:email` - Access user email addresses (primary and public)
- `read:enterprise` - Read enterprise profile data and license information
- `workflow` - Update GitHub Actions workflows

#### Why These Permissions Are Needed

- **`admin:org`**: Required to list all organizations in the enterprise, access organization membership information, and list outside collaborators
- **`read:user`**: Needed to fetch detailed user profile information (name, company, location) for both members and outside collaborators
- **`user:email`**: Required to access user email addresses for the reports
- **`read:enterprise`**: Necessary for enterprise-level organization discovery and license consumption data
- **`workflow`**: Required to create issues and interact with GitHub Actions from the workflow

### Token Setup Instructions

1. **Create PAT**:
   - Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click "Generate new token (classic)"
   - Set expiration as needed (recommend 90 days for security)
   - Select the required scopes listed above

2. **Configure Repository Secret**:
   - Go to your repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `ENTERPRISE_PAT`
   - Value: Your generated PAT
   - Click "Add secret"

### Enterprise Configuration

The pipeline requires your specific enterprise slug to be configured as a repository variable to enable license information tracking.

#### Setup Enterprise Variable

1. **Find Your Enterprise Slug**:
   - Your enterprise slug is the name in your enterprise URL
   - For example: `https://github.com/enterprises/my-company` → slug is `my-company`
   - Or check your enterprise settings page for the exact slug

2. **Configure Repository Variable**:
   - Go to your repository Settings → Secrets and variables → Actions
   - Click on the "Variables" tab
   - Click "New repository variable"
   - Name: `ENTERPRISE_SLUG`
   - Value: Your enterprise slug (e.g., `my-company`)
   - Click "Add variable"

**Note**: The `ENTERPRISE_SLUG` variable is **required** for license information to be included in reports. Without it, the pipeline will collect user data but won't be able to retrieve license types (Visual Studio with GitHub Enterprise vs. GitHub Enterprise only).

## 🗂️ Repository Structure

```text
.
├── .github/
│   └── workflows/
│       └── enterprise-user-report.yml  # Main GitHub Actions workflow
├── scripts/
│   ├── collect-users.js                # Data collection script
│   └── format-issue.js                 # Issue formatting script
├── package.json                        # Node.js dependencies
└── README.md                          # This documentation
```

## 🔄 How It Works

### 1. Scheduled Execution

The pipeline runs automatically every night at 2 AM UTC using a cron schedule:

```yaml
schedule:
  - cron: '0 2 * * *'
```

### 2. Data Collection Process

1. **Enterprise Organization Discovery**: Uses `/enterprises/{enterprise}/orgs` endpoint to list organizations within your specific enterprise
2. **Member Enumeration**: For each org, fetches all members using `/orgs/{org}/members`
3. **Outside Collaborator Collection**: For each org, fetches outside collaborators using `/orgs/{org}/outside_collaborators`
4. **User Details**: Retrieves detailed user information for both members and outside collaborators including:
   - Username and display name
   - Organization role (admin/member) or outside collaborator status
   - Company and location
   - Email address
   - Profile and avatar URLs

### 3. Report Generation

1. **Summary Table**: Shows organization names with:
   - Breakdown of members vs. outside collaborators
   - License distribution (Visual Studio with GitHub Enterprise vs. GitHub Enterprise only)
   - User counts
   - Descriptions
2. **Detailed Tables**: Per-organization tables with:
   - Organization members with their roles (admin/member) and license types
   - Outside collaborators with repository access and license types
   - Separate sections clearly identifying user types for license management
3. **Sorting**: All data sorted alphabetically for consistent presentation
4. **License Information**: Shows which users have Visual Studio subscriptions vs. standard GitHub Enterprise licenses

### 4. Issue Creation

- Creates a new issue with date in title for chronological sorting
- Adds labels: `enterprise-report`, `automated`
- Issue title format: `Enterprise User Report - YYYY-MM-DD`

## 📊 Report Format

Each generated report includes:

### Summary Section

- Total organization count
- Total user count across all organizations
- Summary table with organization names, user counts, license breakdown, and descriptions

### Detailed Section

- Per-organization user tables
- User information includes:
  - Username (linked to GitHub profile)
  - Display name
  - Organization role (for members)
  - **License Type**: Visual Studio with GitHub Enterprise or GitHub Enterprise only
  - Company
  - Location

### License Information

The report distinguishes between two license types:

- **🟦 Visual Studio with GitHub Enterprise** (VS+GitHub): Complete Visual Studio subscription including GitHub Enterprise
- **🟩 GitHub Enterprise**: Standard GitHub Enterprise license without Visual Studio

License information helps managers:

- Track license allocation across organizations
- Identify which organizations use which license types
- Ensure proper license assignment
- Monitor license consumption for budget planning

## 🔧 Manual Execution

To run the pipeline manually:

1. Go to your repository on GitHub
2. Click "Actions" tab
3. Select "Enterprise User Report" workflow
4. Click "Run workflow" button
5. Confirm by clicking "Run workflow"

## ⚠️ Error Handling

The pipeline is configured to **fail fast** on any errors:

- Missing or invalid PAT will cause immediate failure
- API rate limiting will cause delays but eventual success
- Individual user data failures are logged but don't stop processing
- Organization access issues will terminate the pipeline
- Any script errors will fail the entire workflow

## 🔒 Security Considerations

- PAT is stored as a repository secret and never exposed in logs
- All API calls use HTTPS
- No sensitive data is written to temporary files
- Token permissions follow principle of least privilege for required functionality
- Generated issues contain only public profile information

## 📅 Issue Management

Issues are created with:

- **Consistent naming**: `Enterprise User Report - YYYY-MM-DD`
- **Chronological sorting**: Dates in titles ensure natural ordering
- **Clear labeling**: `enterprise-report` and `automated` labels
- **Management-friendly format**: Tables and sections optimized for quick review

## 🐛 Troubleshooting

### Common Issues

1. **"ENTERPRISE_SLUG environment variable is required"**
   - Ensure you've set the `ENTERPRISE_SLUG` repository variable
   - Verify the enterprise slug matches your enterprise URL
   - Double-check the variable name is exactly `ENTERPRISE_SLUG`

2. **"Could not fetch enterprise license data"**
   - Verify PAT has `read:enterprise` scope
   - Ensure the enterprise slug is correct
   - Confirm the PAT account has enterprise admin access
   - Note: License data is optional; the pipeline will continue without it

3. **"No organizations found"**
   - Check PAT has `read:enterprise` scope
   - Verify PAT hasn't expired
   - Ensure PAT is from an account with enterprise access
   - Confirm the enterprise slug is correct

4. **"Rate limit exceeded"**
   - Pipeline includes delays between API calls
   - GitHub Enterprise typically has higher rate limits
   - Workflow will retry automatically

5. **"Permission denied"**
   - Verify all required scopes are granted
   - Check if PAT account has access to target enterprise
   - Ensure PAT account has enterprise member/admin access

## 📞 Support

For issues with this pipeline:

1. Check the Actions tab for detailed error logs
2. Verify PAT permissions and expiration
3. Review organization access for the PAT account
4. Check GitHub Enterprise Cloud API status

---

*This pipeline uses [GitHub Enterprise Cloud REST API endpoints](https://docs.github.com/en/enterprise-cloud@latest/rest)*
