const { Octokit } = require('@octokit/rest');
const fs = require('fs');

async function collectEnterpriseUsers() {
  const token = process.env.GITHUB_TOKEN;
  const enterpriseSlug = process.env.GITHUB_ENTERPRISE;
  
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }

  const octokit = new Octokit({
    auth: token,
  });

  console.log(`Starting enterprise user data collection...`);

  // Fetch license information if enterprise slug is provided
  let licenseData = null;
  if (enterpriseSlug) {
    try {
      console.log(`Fetching enterprise license data for ${enterpriseSlug}...`);
      
      // Fetch all pages of license data
      licenseData = new Map();
      let page = 1;
      let hasMorePages = true;
      let totalUsersProcessed = 0;
      
      while (hasMorePages) {
        const licenseResponse = await octokit.request('GET /enterprises/{enterprise}/consumed-licenses', {
          enterprise: enterpriseSlug,
          per_page: 100,
          page: page,
          headers: {
            'X-GitHub-Api-Version': '2022-11-28'
          }
        });
        
        console.log(`  Page ${page}: Processing ${licenseResponse.data.users.length} users`);
        
        for (const user of licenseResponse.data.users) {
          if (user.github_com_login) {
            totalUsersProcessed++;
            licenseData.set(user.github_com_login, {
              licenseType: user.license_type,
              visualStudioSubscriptionUser: user.visual_studio_subscription_user,
              visualStudioLicenseStatus: user.visual_studio_license_status,
              memberRoles: user.github_com_member_roles || []
            });
            
            // Debug: Log first few users to verify data structure
            if (totalUsersProcessed <= 3) {
              console.log(`  Sample user: ${user.github_com_login} - VS: ${user.visual_studio_subscription_user}, License: ${user.license_type}`);
            }
          }
        }
        
        // Check if there are more pages
        hasMorePages = licenseResponse.data.users.length === 100;
        page++;
      }
      
      console.log(`✓ Fetched license data for ${licenseData.size} users across ${page - 1} page(s)`);
      console.log(`  Total seats consumed: ${licenseResponse.data.total_seats_consumed || 'N/A'}`);
    } catch (licenseError) {
      console.warn(`⚠️  Could not fetch enterprise license data: ${licenseError.message}`);
      console.warn(`   Status: ${licenseError.status || 'unknown'}`);
      console.warn(`   Make sure the token has 'read:enterprise' scope and the enterprise slug '${enterpriseSlug}' is correct.`);
    }
  } else {
    console.log('ℹ️  GITHUB_ENTERPRISE not set - license information will not be included');
  }

  try {
    // Get all organizations for the authenticated user (within enterprise scope)
    console.log(`Fetching organizations accessible to the authenticated user...`);
    const orgsResponse = await octokit.rest.orgs.listForAuthenticatedUser({
      per_page: 100
    });

    if (orgsResponse.data.length === 0) {
      throw new Error('No organizations found. Please check PAT permissions.');
    }

    console.log(`Found ${orgsResponse.data.length} organizations`);

    const organizationData = [];

    // Process each organization
    for (const org of orgsResponse.data) {
      console.log(`Processing organization: ${org.login}`);
      
      try {
        // Get organization members
        const membersResponse = await octokit.rest.orgs.listMembers({
          org: org.login,
          per_page: 100
        });

        // Get outside collaborators
        let outsideCollaborators = [];
        try {
          const collaboratorsResponse = await octokit.rest.orgs.listOutsideCollaborators({
            org: org.login,
            per_page: 100
          });
          outsideCollaborators = collaboratorsResponse.data;
          console.log(`  Found ${outsideCollaborators.length} outside collaborators`);
        } catch (collaboratorError) {
          console.warn(`Could not fetch outside collaborators for ${org.login}: ${collaboratorError.message}`);
        }

        const members = [];
        const collaborators = [];
        
        // Get detailed information for each member
        for (const member of membersResponse.data) {
          try {
            // Get member's organization membership details
            const membershipResponse = await octokit.rest.orgs.getMembershipForUser({
              org: org.login,
              username: member.login
            });

            // Get user profile information
            const userResponse = await octokit.rest.users.getByUsername({
              username: member.login
            });

            members.push({
              username: member.login,
              displayName: userResponse.data.name || member.login,
              role: membershipResponse.data.role,
              userType: 'member',
              company: userResponse.data.company || 'N/A',
              location: userResponse.data.location || 'N/A',
              email: userResponse.data.email || 'N/A',
              profileUrl: member.html_url,
              avatarUrl: member.avatar_url,
              licenseType: licenseData?.get(member.login)?.licenseType || null,
              visualStudioSubscriptionUser: licenseData?.get(member.login)?.visualStudioSubscriptionUser || false
            });

            // Add small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (memberError) {
            console.warn(`Failed to get details for user ${member.login} in ${org.login}:`, memberError.message);
            // Add basic info even if detailed fetch fails
            members.push({
              username: member.login,
              displayName: member.login,
              role: 'unknown',
              userType: 'member',
              company: 'N/A',
              location: 'N/A',
              email: 'N/A',
              profileUrl: member.html_url,
              avatarUrl: member.avatar_url,
              licenseType: licenseData?.get(member.login)?.licenseType || null,
              visualStudioSubscriptionUser: licenseData?.get(member.login)?.visualStudioSubscriptionUser || false
            });
          }
        }

        // Get detailed information for each outside collaborator
        for (const collaborator of outsideCollaborators) {
          try {
            // Get user profile information
            const userResponse = await octokit.rest.users.getByUsername({
              username: collaborator.login
            });

            collaborators.push({
              username: collaborator.login,
              displayName: userResponse.data.name || collaborator.login,
              role: 'outside_collaborator',
              userType: 'outside_collaborator',
              company: userResponse.data.company || 'N/A',
              location: userResponse.data.location || 'N/A',
              email: userResponse.data.email || 'N/A',
              profileUrl: collaborator.html_url,
              avatarUrl: collaborator.avatar_url,
              licenseType: licenseData?.get(collaborator.login)?.licenseType || null,
              visualStudioSubscriptionUser: licenseData?.get(collaborator.login)?.visualStudioSubscriptionUser || false
            });

            // Add small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (collaboratorError) {
            console.warn(`Failed to get details for outside collaborator ${collaborator.login} in ${org.login}:`, collaboratorError.message);
            // Add basic info even if detailed fetch fails
            collaborators.push({
              username: collaborator.login,
              displayName: collaborator.login,
              role: 'outside_collaborator',
              userType: 'outside_collaborator',
              company: 'N/A',
              location: 'N/A',
              email: 'N/A',
              profileUrl: collaborator.html_url,
              avatarUrl: collaborator.avatar_url,
              licenseType: licenseData?.get(collaborator.login)?.licenseType || null,
              visualStudioSubscriptionUser: licenseData?.get(collaborator.login)?.visualStudioSubscriptionUser || false
            });
          }
        }

        // Combine members and collaborators, sorted by username
        const allUsers = [...members, ...collaborators].sort((a, b) => a.username.localeCompare(b.username));

        // Calculate license counts for this organization
        const vsLicenseCount = allUsers.filter(u => u.visualStudioSubscriptionUser === true).length;
        const gheLicenseCount = allUsers.filter(u => u.licenseType === 'enterprise' && u.visualStudioSubscriptionUser !== true).length;
        const unknownLicenseCount = allUsers.filter(u => !u.licenseType).length;
        
        // Debug: Show sample user license data
        if (allUsers.length > 0 && licenseData) {
          const sampleUser = allUsers[0];
          console.log(`  License debug for ${org.login}: Sample user ${sampleUser.username} - VS: ${sampleUser.visualStudioSubscriptionUser}, Type: ${sampleUser.licenseType}`);
          console.log(`  License counts: ${vsLicenseCount} VS+GitHub, ${gheLicenseCount} GitHub Enterprise, ${unknownLicenseCount} unknown`);
        }

        organizationData.push({
          name: org.login,
          displayName: org.name || org.login,
          description: org.description || 'No description',
          memberCount: members.length,
          outsideCollaboratorCount: collaborators.length,
          userCount: allUsers.length,
          visualStudioLicenseCount: vsLicenseCount,
          githubEnterpriseLicenseCount: gheLicenseCount,
          unknownLicenseCount: unknownLicenseCount,
          users: allUsers,
          url: org.html_url
        });

        console.log(`✓ Collected ${members.length} members + ${collaborators.length} outside collaborators = ${allUsers.length} total users from ${org.login}`);
        
      } catch (orgError) {
        console.error(`Failed to process organization ${org.login}:`, orgError.message);
        throw orgError; // Fail the pipeline as requested
      }
    }

    // Sort organizations by name
    organizationData.sort((a, b) => a.name.localeCompare(b.name));

    // Calculate unique users across all organizations
    const allUsernames = new Set();
    const userFirstOrg = new Map(); // Track which org a user first appears in

    // First pass: identify unique users and their "first" organization (alphabetically)
    for (const org of organizationData) {
      for (const user of org.users) {
        if (!allUsernames.has(user.username)) {
          userFirstOrg.set(user.username, org.name);
        }
        allUsernames.add(user.username);
      }
    }

    // Second pass: calculate unique user counts per organization
    for (const org of organizationData) {
      org.uniqueUserCount = org.users.filter(user => 
        userFirstOrg.get(user.username) === org.name
      ).length;
    }

    // Calculate totals
    const totalUsers = organizationData.reduce((sum, org) => sum + org.userCount, 0);
    const totalUniqueUsers = allUsernames.size;
    const totalOrgs = organizationData.length;

    const result = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalOrganizations: totalOrgs,
        totalUsers: totalUsers,
        totalUniqueUsers: totalUniqueUsers
      },
      organizations: organizationData
    };

    // Write data to file for the next step
    fs.writeFileSync('users-data.json', JSON.stringify(result, null, 2));
    
    console.log(`✅ Successfully collected data from ${totalOrgs} organizations with ${totalUsers} total users (${totalUniqueUsers} unique)`);
    console.log('Data written to users-data.json');

    return result;

  } catch (error) {
    console.error('❌ Error collecting enterprise user data:', error.message);
    throw error; // This will cause the GitHub Action to fail
  }
}

// Run the function
collectEnterpriseUsers().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});