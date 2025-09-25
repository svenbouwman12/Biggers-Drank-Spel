// ============================================================================
// SUPABASE SCHEMA INSTALLATION SCRIPT
// ============================================================================
// This script will install the complete database schema in your Supabase project

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase configuration
const SUPABASE_URL = 'https://tmqnpdtbldewusevrgxc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcW5wZHRibGRld3VzZXZyZ3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NTYzNDMsImV4cCI6MjA3NDAzMjM0M30.0YsgPSlp-_Egj72t7e5wZRIWxQWXIouvGY_jXHLS1Ys';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function installSchema() {
    console.log('🚀 Starting Supabase schema installation...');
    
    try {
        // Read the schema file
        const schemaPath = path.join(__dirname, 'supabase_schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('📄 Schema file loaded successfully');
        
        // Split schema into individual statements
        const statements = schema
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        console.log(`📊 Found ${statements.length} SQL statements to execute`);
        
        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            
            if (statement.trim()) {
                console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
                
                try {
                    const { data, error } = await supabase.rpc('exec_sql', {
                        sql: statement
                    });
                    
                    if (error) {
                        console.warn(`⚠️  Warning on statement ${i + 1}:`, error.message);
                    } else {
                        console.log(`✅ Statement ${i + 1} executed successfully`);
                    }
                } catch (err) {
                    console.warn(`⚠️  Error on statement ${i + 1}:`, err.message);
                }
            }
        }
        
        console.log('🎉 Schema installation completed!');
        console.log('📋 Next steps:');
        console.log('1. Check your Supabase dashboard for the new tables');
        console.log('2. Verify the tables are created correctly');
        console.log('3. Test the application with database integration');
        
    } catch (error) {
        console.error('❌ Error installing schema:', error);
        console.log('💡 Manual installation:');
        console.log('1. Go to your Supabase dashboard');
        console.log('2. Open the SQL Editor');
        console.log('3. Copy and paste the content of supabase_schema.sql');
        console.log('4. Click Run to execute the schema');
    }
}

// Alternative: Manual installation instructions
function showManualInstructions() {
    console.log('📋 MANUAL INSTALLATION INSTRUCTIONS:');
    console.log('');
    console.log('1. Go to your Supabase dashboard: https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Go to SQL Editor');
    console.log('4. Copy the entire content of supabase_schema.sql');
    console.log('5. Paste it in the SQL Editor');
    console.log('6. Click "Run" to execute the schema');
    console.log('');
    console.log('📊 Expected tables after installation:');
    console.log('- rooms (game sessions)');
    console.log('- players (players in rooms)');
    console.log('- game_events (real-time events)');
    console.log('- game_rounds (individual rounds)');
    console.log('- votes (player votes/answers)');
    console.log('- round_results (round results)');
    console.log('- game_statistics (player stats)');
    console.log('- achievements (player achievements)');
    console.log('- custom_questions (user questions)');
    console.log('');
    console.log('🔧 After installation:');
    console.log('1. Run: npm install');
    console.log('2. Run: npm start');
    console.log('3. Open: http://localhost:3000');
    console.log('4. Test the application!');
}

// Check if we should run the installation
if (require.main === module) {
    console.log('🗄️ Supabase Database Schema Installation');
    console.log('==========================================');
    console.log('');
    
    // Check if schema file exists
    const schemaPath = path.join(__dirname, 'supabase_schema.sql');
    if (!fs.existsSync(schemaPath)) {
        console.error('❌ supabase_schema.sql file not found!');
        console.log('Make sure the schema file is in the same directory as this script.');
        process.exit(1);
    }
    
    console.log('🔍 Found schema file:', schemaPath);
    console.log('');
    
    // Ask user what they want to do
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    rl.question('Do you want to install the schema automatically? (y/n): ', async (answer) => {
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            await installSchema();
        } else {
            showManualInstructions();
        }
        
        rl.close();
    });
}

module.exports = {
    installSchema,
    showManualInstructions
};
