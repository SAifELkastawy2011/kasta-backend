// debug.js
import pool from './database/db.js';

async function debugDatabase() {
    console.log('🔍 DATABASE DIAGNOSTIC TOOL\n');
    console.log('='.repeat(60));

    try {
        // Check users table
        console.log('\n📊 USERS TABLE:');
        const usersColumns = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY ordinal_position;
        `);
        
        if (usersColumns.rows.length > 0) {
            console.log('✅ Users table exists with columns:');
            usersColumns.rows.forEach(col => {
                console.log(`   - ${col.column_name} (${col.data_type})`);
            });
            
            // Check sample users
            const sampleUser = await pool.query('SELECT id, name, email, role FROM users LIMIT 1');
            if (sampleUser.rows.length > 0) {
                console.log('✅ Sample user found:', sampleUser.rows[0]);
            } else {
                console.log('⚠️ No users found in database');
            }
        } else {
            console.log('❌ Users table does not exist!');
        }

        // Check projects table
        console.log('\n📊 PROJECTS TABLE:');
        const projectsColumns = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'projects'
            ORDER BY ordinal_position;
        `);
        
        if (projectsColumns.rows.length > 0) {
            console.log('✅ Projects table exists with columns:');
            projectsColumns.rows.forEach(col => {
                console.log(`   - ${col.column_name} (${col.data_type})`);
            });
            
            // Check sample projects
            const sampleProject = await pool.query('SELECT id, client_name, client_email, status FROM projects LIMIT 1');
            if (sampleProject.rows.length > 0) {
                console.log('✅ Sample project found:', sampleProject.rows[0]);
            } else {
                console.log('⚠️ No projects found in database');
            }
        } else {
            console.log('❌ Projects table does not exist!');
        }

        // Check templates table
        console.log('\n📊 TEMPLATES TABLE:');
        const templatesColumns = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'templates'
            ORDER BY ordinal_position;
        `);
        
        if (templatesColumns.rows.length > 0) {
            console.log('✅ Templates table exists with columns:');
            templatesColumns.rows.forEach(col => {
                console.log(`   - ${col.column_name} (${col.data_type})`);
            });
            
            // Check sample templates
            const sampleTemplate = await pool.query('SELECT id, name, category, is_active FROM templates LIMIT 1');
            if (sampleTemplate.rows.length > 0) {
                console.log('✅ Sample template found:', sampleTemplate.rows[0]);
            } else {
                console.log('⚠️ No templates found in database');
            }
        } else {
            console.log('❌ Templates table does not exist!');
        }

        // Check foreign key relationships
        console.log('\n🔗 FOREIGN KEY CONSTRAINTS:');
        const foreignKeys = await pool.query(`
            SELECT
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_name IN ('projects', 'users', 'templates');
        `);
        
        if (foreignKeys.rows.length > 0) {
            foreignKeys.rows.forEach(fk => {
                console.log(`   ✅ ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
            });
        } else {
            console.log('   No foreign key constraints found');
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ Database diagnostic complete');

    } catch (error) {
        console.error('❌ Database diagnostic error:', error.message);
        console.error('Full error:', error);
    } finally {
        await pool.end();
    }
}

debugDatabase();