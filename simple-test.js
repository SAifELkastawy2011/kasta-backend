import axios from 'axios';

const BASE_URL = 'http://localhost:5500/api/v1';

async function testRefresh() {
    console.log('\n🧪 TESTING REFRESH ENDPOINT\n');
    console.log('='.repeat(60));
    
    // Step 1: Login to get cookies and access token
    console.log('\n1️⃣ Logging in...');
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
        email: 'saif.elkastawy2011@gmail.com',
        password: '2011Saif'
    }, { 
        withCredentials: true 
    });
    
    console.log('✅ Login successful');
    console.log(`   Access Token: ${loginRes.data.accessToken.substring(0, 50)}...`);
    console.log(`   User: ${loginRes.data.user.email}`);
    console.log(`   Cookies set:`, loginRes.headers['set-cookie']?.map(c => c.split(';')[0]));
    
    // Step 2: Test refresh endpoint
    console.log('\n2️⃣ Testing refresh endpoint...');
    
    try {
        const refreshRes = await axios.post(`${BASE_URL}/auth/refresh`, {}, {
            withCredentials: true,
            headers: {
                'Cookie': loginRes.headers['set-cookie']?.join('; ')
            }
        });
        
        console.log('✅ Refresh successful!');
        console.log(`   New Access Token: ${refreshRes.data.accessToken.substring(0, 50)}...`);
        console.log(`   Expires in: ${refreshRes.data.expiresIn} seconds`);
        
        // Step 3: Test the new token
        console.log('\n3️⃣ Testing new access token...');
        const meRes = await axios.get(`${BASE_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${refreshRes.data.accessToken}` },
            withCredentials: true
        });
        
        console.log('✅ New token works!');
        console.log(`   User: ${meRes.data.user.email}`);
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 Refresh endpoint is working perfectly!\n');
        
    } catch (error) {
        console.log('❌ Refresh failed:');
        console.log(`   Status: ${error.response?.status}`);
        console.log(`   Message: ${error.response?.data?.message}`);
        console.log(`   Code: ${error.response?.data?.code}`);
        
        // Try alternative: Send refresh token in body
        console.log('\n3️⃣ Trying alternative: Send refresh token in body...');
        
        // Get refresh token from cookie
        const cookieHeader = loginRes.headers['set-cookie']?.find(c => c.includes('refreshToken'));
        const refreshToken = cookieHeader?.split(';')[0]?.split('=')[1];
        
        if (refreshToken) {
            try {
                const refreshRes2 = await axios.post(`${BASE_URL}/auth/refresh`, {
                    refreshToken: refreshToken
                }, { withCredentials: true });
                
                console.log('✅ Refresh successful via body!');
                console.log(`   New Access Token: ${refreshRes2.data.accessToken.substring(0, 50)}...`);
            } catch (err) {
                console.log('❌ Body method also failed:', err.response?.data?.message);
            }
        }
    }
}

testRefresh();