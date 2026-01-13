/********************************************************************
 * ENVIRONMENT SETUP
 ********************************************************************/

// dotenv वापरून .env file मधील variables (DB_URL, PASSWORD etc.)
// process.env मध्ये load होतात
import dotenv from "dotenv";
dotenv.config();
// ⚠️ हे सर्वात वर असणं गरजेचं आहे
// कारण DB, server इ. process.env वापरतात


/********************************************************************
 * LIBRARY IMPORTS
 ********************************************************************/

// Node.js साठी lightweight web framework
import express from "express";

// Express + GraphQL जोडणारा middleware
import { graphqlHTTP } from "express-graphql";

// GraphQL schema string → executable schema मध्ये convert करतो
import { buildSchema } from "graphql";

// PostgreSQL connection pool (db.ts मधून)
import pool from "./db";

// Cross-Origin Resource Sharing
// Frontend (5173) → Backend (4000) allow करण्यासाठी
import cors from "cors";


/********************************************************************
 * TYPESCRIPT TYPES (Compile-time safety)
 ********************************************************************/

// Expense entity कशी दिसते ते define
// ⚠️ हे फक्त TypeScript साठी आहे, runtime ला वापर होत नाही
type Expense = {
    name: string;
    id: string;
    amount: number;
    description: string;
    userId: string;
}

// User entity
type User = {
    id: string;
    name: string;
}

// Simple message entity (DB वापरत नाही)
type Message = {
    id: string;
    text: string
};


/********************************************************************
 * EXPRESS APP INITIALIZATION
 ********************************************************************/

// Express app create
const app = express();

// Server port
const PORT = 4000;


/********************************************************************
 * TEMPORARY IN-MEMORY STORAGE
 ********************************************************************/

// ⚠️ हे production-ready नाही
// Server restart झाला तर data गायब होईल
const messages: Message[] = [];

/********************************************************************
 * MIDDLEWARE SETUP
 ********************************************************************/

// CORS configuration
app.use(
    cors({
        // Frontend URL allow
        origin: "http://localhost:5173",

        // Cookies / Authorization headers allow
        credentials: true
    })
);

// Incoming request body JSON → JS object
// GraphQL mutations साठी आवश्यक
app.use(express.json());


/********************************************************************
 * GRAPHQL SCHEMA DEFINITION
 ********************************************************************/

// GraphQL मध्ये schema म्हणजे CONTRACT
// Frontend काय मागू शकतो + backend काय देऊ शकतो
const schema = buildSchema(`

    input AddExpenseInput {
        name: String!
        amount: Float!
        description: String!
        userId: ID!
    }

    type Expense {
        name: String!
        id: ID!
        amount: Float!
        description: String!
        userId: ID!
    }

    type User {
        id: ID!
        name: String
    }

    type Message {
        id: ID!
        text: String!
    }

    type Query {
        messages: [Message]
        users: [User]
        expenses: [Expense]
        expensesByUser(userId: ID!): [Expense]
        totalExpense: Float
    }

    type Mutation {
        addMessage(text: String!): Message
        addUser(name: String!): User
        addExpense(input: AddExpenseInput): Expense
        deleteExpense(id: ID!): Boolean
        updateExpense(
            id: ID!
            amount: Float!
            description: String!
        ): Expense
    } 
`);


/********************************************************************
 * ROOT RESOLVERS
 * 👉 Schema मधील प्रत्येक field साठी function
 ********************************************************************/

const root = {

    /**********************
     * ADD EXPENSE
     **********************/
    addExpense: async ({ input }: { input: any }) => {

        // Step 1️⃣ : User exists का check
        const u = await pool.query(
            "SELECT id FROM users WHERE id = $1",
            [input.userId]
        );

        // User नाही तर mutation fail
        if (u.rows.length === 0) {
            throw new Error("User does not exist");
        }

        // Step 2️⃣ : Business validations
        if (input.amount <= 0) {
            throw new Error("Amount must be greater than 0");
        }

        if (input.description.trim().length < 3) {
            throw new Error("Description must be at least 3 characters long");
        }

        // Step 3️⃣ : Unique ID generate
        // ⚠️ Production मध्ये UUID वापरतात
        const id = Date.now().toString();

        // Step 4️⃣ : Insert query
        const query = `
            INSERT INTO expenses (id, name, amount, description, user_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;

        // Step 5️⃣ : Query execute
        const result = await pool.query(query, [
            id,
            input.name,
            input.amount,
            input.description,
            input.userId
        ]);

        // Step 6️⃣ : DB → GraphQL mapping
        return {
            id: result.rows[0].id,
            name: result.rows[0].name,
            amount: result.rows[0].amount,
            description: result.rows[0].description,
            userId: result.rows[0].user_id
        };
    },


    /**********************
     * GET ALL EXPENSES
     **********************/
    expenses: async () => {

        // DB मधून सर्व records
        const result = await pool.query("SELECT * FROM expenses");

        // PostgreSQL snake_case → GraphQL camelCase
        return result.rows.map(r => ({
            id: r.id,
            name: r.name,
            amount: r.amount,
            description: r.description,
            userId: r.user_id
        }));
    },


    /**********************
     * TOTAL EXPENSE
     **********************/
    totalExpense: async () => {

        // SUM null असेल तर 0 return
        const result = await pool.query(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM expenses"
        );

        // PostgreSQL numeric → JS number
        return Number(result.rows[0].total);
    },


    /**********************
     * ADD MESSAGE (No DB)
     **********************/
    addMessage: ({ text }: { text: string }) => {

        // Simple object
        const message = {
            id: Date.now().toString(),
            text,
        };

        // Array मध्ये push
        messages.push(message);

        return message;
    },


    /**********************
     * GET MESSAGES
     **********************/
    messages: () => {
        return messages;
    },


    /**********************
     * ADD USER
     **********************/
    addUser: async ({ name }: { name: string }) => {

        const id = Date.now().toString();

        const query = `
            INSERT INTO users (id, name)
            VALUES ($1, $2)
            RETURNING *;
        `;

        const result = await pool.query(query, [id, name]);

        return {
            id: result.rows[0].id,
            name: result.rows[0].name
        };
    },


    /**********************
     * GET USERS
     **********************/
    users: async () => {

        // Latest users first
        const result = await pool.query(
            "SELECT id, name FROM users ORDER BY created_at DESC"
        );

        return result.rows.map(r => ({
            id: r.id,
            name: r.name
        }));
    },


    /**********************
     * EXPENSES BY USER
     **********************/
    expensesByUser: async ({ userId }: { userId: string }) => {

        const result = await pool.query(
            `SELECT id, name, amount, description, user_id
             FROM expenses
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [userId]
        );

        return result.rows.map(r => ({
            id: r.id,
            name: r.name,
            amount: Number(r.amount),
            description: r.description,
            userId: r.user_id
        }));
    },


    /**********************
     * DELETE EXPENSE
     **********************/
    deleteExpense: async ({ id }: { id: string }) => {

        const result = await pool.query(
            "DELETE FROM expenses WHERE id = $1",
            [id]
        );

        // rowCount > 0 → delete success
        return (result.rowCount ?? 0) > 0;
    },


    /**********************
     * UPDATE EXPENSE
     **********************/
    updateExpense: async (
        { id, amount, description }:
            { id: string; amount: number; description: string }
    ) => {

        const query = `
            UPDATE expenses
            SET amount = $2,
                description = $3
            WHERE id = $1
            RETURNING *;
        `;

        const result = await pool.query(query, [
            id,
            amount,
            description
        ]);

        // ID चूक असेल तर
        if (result.rows.length === 0) {
            throw new Error("Expense not found");
        }

        return {
            id: result.rows[0].id,
            name: result.rows[0].name,
            amount: Number(result.rows[0].amount),
            description: result.rows[0].description,
            userId: result.rows[0].user_id
        };
    }
};


/********************************************************************
 * GRAPHQL ENDPOINT
 ********************************************************************/

app.use(
    "/graphql",
    graphqlHTTP({
        schema,
        rootValue: root,
        graphiql: true, // Browser UI
    })
);


/********************************************************************
 * HEALTH CHECK
 ********************************************************************/

app.get("/ping", (_req, res) => {
    res.send("Server is running");
});


/********************************************************************
 * SERVER START
 ********************************************************************/

app.listen(PORT, () => {
    console.log(`Server started on PORT ${PORT}`);
});
