# BitterGuard Admin Dashboard

Admin dashboard website for viewing statistics, managing users, and analyzing scan data from the BitterGuard Mobile app.

## Features

- 📊 **Dashboard Overview**: Real-time statistics and charts
- 👥 **User Management**: View and manage all app users
- 🔍 **Scan Statistics**: Detailed scan history with filters
- 📈 **Analytics**: Disease distribution and usage trends
- 🔐 **Secure Login**: Admin-only access control

## Setup Instructions

### Option 1: Simple (No installation needed)

1. Open `login.html` in your web browser
2. Login with admin credentials
3. Start using the dashboard!

### Option 2: Using a Local Server (Recommended)

1. **Install Node.js** (if not already installed)
   - Download from: https://nodejs.org/

2. **Open terminal in this folder**
   ```bash
   cd e:\bitterguard_admin
   ```

3. **Install dependencies** (optional, but recommended)
   ```bash
   npm install
   ```

4. **Start local server**
   ```bash
   npm start
   ```
   Or use the built-in VS Code Live Server extension

5. **Open in browser**
   - Navigate to: `http://localhost:3000/login.html`

## Admin Access Setup

### Important: Setting up Admin User

Before you can login, you need to set a user's role to "admin" in your Supabase database:

1. Go to your Supabase dashboard: https://app.supabase.com
2. Navigate to the **Table Editor**
3. Open the `users` table
4. Find or create a user record
5. Set the `role` column to `"admin"` (or `"Admin"`)
6. Save the changes

### Login Credentials

Use the same email/password that's associated with the admin user in Supabase Auth.

## File Structure

```
bitterguard_admin/
├── index.html          # Main dashboard page
├── login.html          # Admin login page
├── users.html          # User management page
├── scans.html          # Scan statistics page
├── style.css           # All styling
├── app.js              # Dashboard main logic
├── supabase.js         # Supabase configuration & utilities
├── package.json        # Dependencies
└── README.md           # This file
```

## Database Tables Used

The dashboard connects to these Supabase tables:

- `users` - User accounts and profiles
- `history` - Scan history and results

## Security Notes

⚠️ **Important**: 
- The API key in `supabase.js` is the **anon key** (safe for frontend)
- For production, consider using Row Level Security (RLS) policies
- Admin authentication checks user role in the `users` table
- Never commit the service_role key to version control

## Customization

### Change Colors

Edit the CSS variables in `style.css`:
```css
:root {
    --primary-color: #4CAF50;  /* Change this */
    --secondary-color: #2196F3;
    /* ... */
}
```

### Add More Statistics

Edit `app.js` to add new stat cards or charts.

## Troubleshooting

### Can't login?
- Make sure your user has `role = "admin"` in the `users` table
- Check that Supabase URL and API key are correct in `supabase.js`

### Charts not showing?
- Make sure Chart.js is loading (check browser console)
- Check that there's data in the `history` table

### Data not loading?
- Check browser console for errors
- Verify Supabase connection
- Check that tables exist and have data

## Deployment

For production deployment:

1. **Use a web hosting service**:
   - Vercel (recommended)
   - Netlify
   - GitHub Pages
   - Your own server

2. **Update environment variables** if needed

3. **Enable HTTPS** for security

## Support

For issues or questions, contact: ampalayapicture@gmail.com

## License

MIT License

