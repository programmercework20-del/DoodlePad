import pg from 'pg';
const { Client } = pg;

const createDatabase = async () => {
    // First connect to default 'postgres' database
    const client = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: '12345', // Your password
        database: 'postgres' // Connect to default database
    });

    try {
        await client.connect();
        console.log('✅ Connected to PostgreSQL');

        // Check if database exists
        const checkDB = await client.query(
            "SELECT 1 FROM pg_database WHERE datname = 'admin_db'"
        );

        if (checkDB.rowCount === 0) {
            // Database doesn't exist, create it
            await client.query('CREATE DATABASE admin_db');
            console.log('✅ Database "admin_db" created successfully!');
        } else {
            console.log('⚠️  Database "admin_db" already exists!');
        }

        await client.end();
        console.log('\n🎉 Database setup complete!');
        console.log('Now you can run: npm run seed\n');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating database:', error.message);
        console.error('\nPlease check:');
        console.error('1. PostgreSQL is running');
        console.error('2. Password is correct (currently set to: 12345)');
        console.error('3. User "postgres" exists\n');
        await client.end();
        process.exit(1);
    }
};

createDatabase();
