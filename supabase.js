// Supabase Configuration
const SUPABASE_URL = 'https://bihiognjjtaztmepehtv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpaGlvZ25qanRhenRtZXBlaHR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyOTU4MzcsImV4cCI6MjA3Mzg3MTgzN30.-5C_l2jMgyFfItcmCX5uXGbJi3QSI8irJ7UGQ7JHLkE';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Optional auth guard debugger (toggle via localStorage or helper below)
const AUTH_DEBUG = localStorage.getItem('debug_auth') === 'true';

// Check authentication on page load
window.addEventListener('DOMContentLoaded', async () => {
    // Skip auth check on login page
    if (window.location.pathname.includes('login.html')) {
        return;
    }

    try {
        console.log('=== Starting auth check ===');
        
        // Check if redirects are disabled for debugging
        const preventRedirect = localStorage.getItem('prevent_redirect') === 'true';
        if (preventRedirect) {
            console.warn('⚠️ REDIRECTS DISABLED FOR DEBUGGING');
            console.warn('Set localStorage.removeItem("prevent_redirect") to re-enable redirects');
        }
        
        if (AUTH_DEBUG) {
            console.warn('Auth guard paused (debug_auth enabled). Use authDebug.disable() to resume redirects.');
            debugger; // Pause before running auth logic so the dashboard can be inspected
        }
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
            console.error('❌ Session error:', sessionError);
            if (!preventRedirect) {
                window.location.href = 'login.html';
            }
            return;
        }
        
        if (!session) {
            console.error('❌ No session found. Redirecting to login.');
            if (!preventRedirect) {
                window.location.href = 'login.html';
            }
            return;
        }

        console.log('✅ Session found. User ID:', session.user.id);
        console.log('✅ User email:', session.user.email);

        // Small delay to ensure session is fully established
        await new Promise(resolve => setTimeout(resolve, 100));

        // Verify admin role
        const isAdmin = await checkAdminRole(session.user.id);
        console.log('=== Admin check result ===', isAdmin);
        
        if (!isAdmin) {
            console.error('❌ Admin check FAILED. User does not have admin privileges.');
            console.log('Signing out and redirecting to login...');
            await supabase.auth.signOut();
            localStorage.removeItem('admin_session');
            if (!preventRedirect) {
                window.location.href = 'login.html?error=access_denied';
            }
            return;
        }
        
        console.log('✅ Admin check PASSED. Access granted.');
        localStorage.setItem('admin_session', 'active');
    } catch (error) {
        console.error('❌ Fatal error in auth check:', error);
        console.error('Error details:', error.stack);
        const preventRedirect = localStorage.getItem('prevent_redirect') === 'true';
        if (!preventRedirect) {
            window.location.href = 'login.html?error=system_error';
        }
    }
});

// Check if user has admin role
async function checkAdminRole(userId) {
    try {
        console.log('🔍 Querying users table for auth_user_id:', userId);
        
        // Try a simple test query first
        const { data: testData, error: testError } = await supabase
            .from('users')
            .select('id')
            .limit(1);
        
        if (testError) {
            console.error('❌ Cannot access users table:', testError);
            console.error('Error code:', testError.code);
            console.error('Error message:', testError.message);
            
            // Check for infinite recursion error (42P17)
            if (testError.code === '42P17' || testError.message?.includes('infinite recursion')) {
                console.error('🔴 RLS INFINITE RECURSION ERROR DETECTED!');
                console.error('═══════════════════════════════════════════════════════════');
                console.error('Your RLS policy on the "users" table is causing infinite recursion.');
                console.error('This happens when a policy checks the "users" table, which triggers');
                console.error('the same policy again, creating an infinite loop.');
                console.error('');
                console.error('SOLUTION:');
                console.error('1. Go to your Supabase Dashboard → SQL Editor');
                console.error('2. Run the SQL from fix_rls_policy.sql file');
                console.error('   OR copy this quick fix:');
                console.error('');
                console.error('   DROP POLICY IF EXISTS "Allow admins to read users" ON users;');
                console.error('   CREATE POLICY "Allow authenticated users to read users"');
                console.error('   ON users FOR SELECT TO authenticated USING (true);');
                console.error('');
                console.error('3. Refresh this page and try again');
                console.error('═══════════════════════════════════════════════════════════');
                return false;
            }
            
            if (testError.code === '500' || testError.message?.includes('500')) {
                console.error('🔴 Server Error (500): Database server error detected!');
                console.error('This could be caused by:');
                console.error('1. Missing database column');
                console.error('2. Database constraint violation');
                console.error('3. Database trigger/function error');
                console.error('4. RLS policy causing server-side error');
                console.error('Check your Supabase dashboard logs for more details.');
            }
            return false;
        }
        
        const { data, error } = await supabase
            .from('users')
            .select('is_super_admin, auth_user_id, email, id, role')
            .eq('auth_user_id', userId)
            .maybeSingle(); // Use maybeSingle() to avoid error if no match

        if (error) {
            console.error('❌ Database query error:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            console.error('Error details:', error.details);
            console.error('Error hint:', error.hint);
            console.log('User ID being checked:', userId);
            
            // Try alternative query
            console.log('🔄 Trying alternative query...');
            const { data: altData, error: altError } = await supabase
                .from('users')
                .select('role, auth_user_id, email, id')
                .eq('auth_user_id', userId)
                .maybeSingle();
            
            if (!altError && altData) {
                console.log('✅ Found user with alternative query');
                const role = (altData.role || '').toLowerCase();
                return role === 'admin' || role === 'super_admin';
            }
            
            return false;
        }

        if (!data) {
            console.error('❌ No user record found with auth_user_id:', userId);
            console.log('Checking if user exists with different auth_user_id...');
            
            // Try to find user by checking all records
            const { data: allUsers } = await supabase
                .from('users')
                .select('id, auth_user_id, email, is_super_admin')
                .limit(20);
            console.log('All users in table (for debugging):', allUsers);
            
            return false;
        }
        
        console.log('✅ User record found:', {
            id: data.id,
            auth_user_id: data.auth_user_id,
            email: data.email,
            is_super_admin: data.is_super_admin,
            is_super_admin_type: typeof data.is_super_admin
        });
        
        // Check if is_super_admin is true OR role is admin (handle boolean, string, or null)
        const isSuperAdmin = data.is_super_admin === true || 
                            data.is_super_admin === 'true' || 
                            data.is_super_admin === 1 ||
                            String(data.is_super_admin).toLowerCase() === 'true';
        
        const roleIsAdmin = (data.role || '').toLowerCase() === 'admin' ||
                           (data.role || '').toLowerCase() === 'super_admin';
        
        const isAdmin = isSuperAdmin || roleIsAdmin;
        
        console.log('🔐 Admin check calculation:', {
            raw_is_super_admin: data.is_super_admin,
            is_super_admin_check: isSuperAdmin,
            raw_role: data.role,
            role_check: roleIsAdmin,
            final_result: isAdmin
        });
        
        if (isAdmin) {
            // Store admin email as name (since name column doesn't exist)
            if (data.email) {
                const adminNameEl = document.getElementById('adminName');
                if (adminNameEl) adminNameEl.textContent = data.email;
            }
            console.log('✅ User is confirmed admin');
            return true;
        }
        
        console.warn('⚠️ User is NOT admin. is_super_admin value:', data.is_super_admin);
        return false;
    } catch (error) {
        console.error('❌ Exception in checkAdminRole:', error);
        console.error('Error stack:', error.stack);
        return false;
    }
}

// Logout function
async function logout() {
    if (confirm('Are you sure you want to logout?')) {
        await supabase.auth.signOut();
        localStorage.removeItem('admin_session');
        window.location.href = 'login.html';
    }
}

// Format date helper
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(parseInt(timestamp));
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format date for input (YYYY-MM-DD)
function formatDateInput(timestamp) {
    if (!timestamp) return '';
    const date = new Date(parseInt(timestamp));
    return date.toISOString().split('T')[0];
}

// Export for use in other files
window.supabaseUtils = {
    supabase,
    checkAdminRole,
    logout,
    formatDate,
    formatDateInput
};

// Simple helpers to toggle the auth debugger from the console
window.authDebug = {
    enable() {
        localStorage.setItem('debug_auth', 'true');
        console.log('Auth debugger enabled. Reload the page to pause before redirects.');
    },
    disable() {
        localStorage.removeItem('debug_auth');
        console.log('Auth debugger disabled. Reload the page to restore normal redirects.');
    },
    preventRedirect() {
        localStorage.setItem('prevent_redirect', 'true');
        console.log('✅ Redirects disabled. You can now inspect the dashboard without being redirected.');
        console.log('Log in and navigate to the dashboard to see console errors.');
        console.log('Use authDebug.allowRedirect() to re-enable redirects.');
    },
    allowRedirect() {
        localStorage.removeItem('prevent_redirect');
        console.log('✅ Redirects re-enabled. Reload the page to apply.');
    }
};

