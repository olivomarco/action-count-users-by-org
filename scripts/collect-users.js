const { Octokit } = require('@octokit/rest');
const fs = require('fs');

async function collectEnterpriseUsers() {
  const token = process.env.GITHUB_TOKEN;
  const enterpriseSlug = process.env.ENTERPRISE_SLUG;
  
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }
  
  if (!enterpriseSlug) {
    throw new Error('ENTERPRISE_SLUG environment variable is required');
  }

  const octokit = new Octokit({
    auth: token,
  });

  console.log(`Starting enterprise user data collection for: ${enterpriseSlug}`);

  try {
    // Get all organizations in the specific enterprise
    console.log(`Fetching organizations for enterprise: ${enterpriseSlug}`);
    const orgsResponse = await octokit.rest.enterprises.listOrgs({
      enterprise: enterpriseSlug,
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

        const members = [];
        
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
              company: userResponse.data.company || 'N/A',
              location: userResponse.data.location || 'N/A',
              email: userResponse.data.email || 'N/A',
              profileUrl: member.html_url,
              avatarUrl: member.avatar_url
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
              company: 'N/A',
              location: 'N/A',
              email: 'N/A',
              profileUrl: member.html_url,
              avatarUrl: member.avatar_url
            });
          }
        }

        organizationData.push({
          name: org.login,
          displayName: org.name || org.login,
          description: org.description || 'No description',
          userCount: members.length,
          users: members.sort((a, b) => a.username.localeCompare(b.username)),
          url: org.html_url
        });

        console.log(`✓ Collected ${members.length} users from ${org.login}`);
        
      } catch (orgError) {
        console.error(`Failed to process organization ${org.login}:`, orgError.message);
        throw orgError; // Fail the pipeline as requested
      }
    }

    // Sort organizations by name
    organizationData.sort((a, b) => a.name.localeCompare(b.name));

    // Calculate totals
    const totalUsers = organizationData.reduce((sum, org) => sum + org.userCount, 0);
    const totalOrgs = organizationData.length;

    const result = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalOrganizations: totalOrgs,
        totalUsers: totalUsers
      },
      organizations: organizationData
    };

    // Write data to file for the next step
    fs.writeFileSync('users-data.json', JSON.stringify(result, null, 2));
    
    console.log(`✅ Successfully collected data from ${totalOrgs} organizations with ${totalUsers} total users`);
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