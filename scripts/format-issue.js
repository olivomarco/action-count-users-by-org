const fs = require('fs');

function formatIssueContent() {
  const dataFile = process.env.USER_DATA_FILE || 'users-data.json';
  
  if (!fs.existsSync(dataFile)) {
    throw new Error(`Data file ${dataFile} not found`);
  }

  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const generatedDate = new Date(data.generatedAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let issueContent = `# Enterprise User Report

**Generated:** ${generatedDate}  
**Total Organizations:** ${data.summary.totalOrganizations}  
**Total Users:** ${data.summary.totalUsers}  
**Total Unique Users:** ${data.summary.totalUniqueUsers}

---

## 📊 Organization Summary

| Organization | Total Users | Members | Outside Collaborators | VS+GitHub | GitHub Only | Unknown | Unique Users | Description |
|-------------|-------------|---------|---------------------|-----------|-------------|---------|-------------|-------------|
`;

  // Add summary table rows
  for (const org of data.organizations) {
    const description = org.description.length > 50 
      ? org.description.substring(0, 47) + '...' 
      : org.description;
    
    const memberCount = org.memberCount || 0;
    const outsideCollaboratorCount = org.outsideCollaboratorCount || 0;
    const vsLicenseCount = org.visualStudioLicenseCount || 0;
    const gheLicenseCount = org.githubEnterpriseLicenseCount || 0;
    const unknownLicenseCount = org.unknownLicenseCount || 0;
    
    // Format license counts - show in bold if non-zero, otherwise just number
    const vsFormatted = vsLicenseCount > 0 ? `**${vsLicenseCount}**` : vsLicenseCount;
    const gheFormatted = gheLicenseCount > 0 ? `**${gheLicenseCount}**` : gheLicenseCount;
    const unknownFormatted = unknownLicenseCount > 0 ? `⚠️ ${unknownLicenseCount}` : unknownLicenseCount;
    
    issueContent += `| [${org.displayName}](https://github.com/${org.name}) | **${org.userCount}** | ${memberCount} | ${outsideCollaboratorCount} | ${vsFormatted} | ${gheFormatted} | ${unknownFormatted} | **${org.uniqueUserCount}** | ${description} |\n`;
  }

  issueContent += `
---

## 👥 Detailed User Information

`;

  // Add detailed user information for each organization
  for (const org of data.organizations) {
    const memberCount = org.memberCount || 0;
    const outsideCollaboratorCount = org.outsideCollaboratorCount || 0;
    const vsLicenseCount = org.visualStudioLicenseCount || 0;
    const gheLicenseCount = org.githubEnterpriseLicenseCount || 0;
    const unknownLicenseCount = org.unknownLicenseCount || 0;
    
    // Build license breakdown string
    let licenseInfo = '';
    if (vsLicenseCount > 0 || gheLicenseCount > 0) {
      const parts = [];
      if (vsLicenseCount > 0) parts.push(`${vsLicenseCount} VS+GitHub`);
      if (gheLicenseCount > 0) parts.push(`${gheLicenseCount} GitHub Enterprise`);
      if (unknownLicenseCount > 0) parts.push(`${unknownLicenseCount} unknown`);
      licenseInfo = ` - Licenses: ${parts.join(', ')}`;
    } else if (unknownLicenseCount > 0) {
      licenseInfo = ` - ⚠️ License info not available`;
    }
    
    issueContent += `
### 🏢 ${org.displayName} (${org.userCount} users: ${memberCount} members, ${outsideCollaboratorCount} outside collaborators${licenseInfo})
`;

    // First show organization members
    const members = org.users.filter(user => user.userType === 'member');
    if (members.length > 0) {
      issueContent += `
#### 👥 Organization Members (${memberCount})

| Username | Display Name | Role | License Type | Company | Location |
|----------|-------------|------|--------------|---------|----------|
`;

      for (const user of members) {
        const displayName = user.displayName !== user.username ? user.displayName : '-';
        const company = user.company !== 'N/A' ? user.company : '-';
        const location = user.location !== 'N/A' ? user.location : '-';
        
        // Format license type
        let licenseType = '-';
        if (user.visualStudioSubscriptionUser) {
          licenseType = '🟦 **VS+GitHub**';
        } else if (user.licenseType === 'enterprise') {
          licenseType = '🟩 GitHub Enterprise';
        } else if (user.licenseType) {
          licenseType = user.licenseType;
        }
        
        issueContent += `| [@${user.username}](${user.profileUrl}) | ${displayName} | \`${user.role}\` | ${licenseType} | ${company} | ${location} |\n`;
      }
    }

    // Then show outside collaborators
    const collaborators = org.users.filter(user => user.userType === 'outside_collaborator');
    if (collaborators.length > 0) {
      issueContent += `
#### 🤝 Outside Collaborators (${outsideCollaboratorCount})

| Username | Display Name | License Type | Company | Location |
|----------|-------------|--------------|---------|----------|
`;

      for (const user of collaborators) {
        const displayName = user.displayName !== user.username ? user.displayName : '-';
        const company = user.company !== 'N/A' ? user.company : '-';
        const location = user.location !== 'N/A' ? user.location : '-';
        
        // Format license type
        let licenseType = '-';
        if (user.visualStudioSubscriptionUser) {
          licenseType = '🟦 **VS+GitHub**';
        } else if (user.licenseType === 'enterprise') {
          licenseType = '🟩 GitHub Enterprise';
        } else if (user.licenseType) {
          licenseType = user.licenseType;
        }
        
        issueContent += `| [@${user.username}](${user.profileUrl}) | ${displayName} | ${licenseType} | ${company} | ${location} |\n`;
      }
    }

    issueContent += '\n';
  }

  issueContent += `
---

## 📝 Report Details

- **Report Type:** Automated Enterprise User Audit
- **Scope:** All accessible organizations in the enterprise
- **Data Collection:** GitHub Enterprise Cloud API
- **Next Report:** Tomorrow at the same time

### 🔄 Automation Info

This report is automatically generated by GitHub Actions and runs every night at 2 AM UTC. 
The data includes all users across organizations that the configured Personal Access Token has access to.

### 🔢 Unique User Counting

Users who appear in multiple organizations are counted uniquely based on the first organization they appear in (alphabetically). This prevents double-counting of users across organizations.

- **Users**: Total number of memberships across all organizations
- **Unique Users**: Users counted only once, attributed to their first organization alphabetically

### � License Types

License information is retrieved from the GitHub Enterprise licensing API:

- **🟦 VS+GitHub (Visual Studio with GitHub Enterprise)**: Complete Visual Studio subscription including GitHub Enterprise
- **🟩 GitHub Enterprise**: Standard GitHub Enterprise license without Visual Studio
- **⚠️ Unknown**: License information not available (requires enterprise admin access and GITHUB_ENTERPRISE environment variable)

Each organization may have a mix of different license types. Both members and outside collaborators consume licenses.

### �📋 Actions for Managers

1. **Review user counts** in the summary table above (members, outside collaborators, and unique totals)
2. **Check license distribution** to ensure proper allocation between Visual Studio and GitHub Enterprise licenses
3. **Review organization members** and their roles in each organization
4. **Review outside collaborators** who have repository access but aren't organization members
5. **Verify user information** is up to date and licenses are properly assigned
6. **Report any discrepancies** to the IT team

### 🔍 Understanding User Types

- **Organization Members**: Users who are formal members of the GitHub organization
- **Outside Collaborators**: Users who have access to specific repositories but are not organization members
- **Licenses**: Both members and outside collaborators typically require licenses in GitHub Enterprise

---

*This issue was automatically created by the Enterprise User Report workflow*
`;

  // Write the formatted content to file
  fs.writeFileSync('issue-content.md', issueContent);
  
  console.log('✅ Issue content formatted and written to issue-content.md');
  console.log(`📊 Report contains ${data.summary.totalOrganizations} organizations and ${data.summary.totalUsers} users (${data.summary.totalUniqueUsers} unique)`);
}

// Run the formatting function
try {
  formatIssueContent();
} catch (error) {
  console.error('❌ Error formatting issue content:', error.message);
  process.exit(1);
}