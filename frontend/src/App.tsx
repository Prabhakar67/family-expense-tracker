import { useEffect, useState } from "react";
import client from "./graphql";
import { gql } from "@apollo/client";

type ExpensesResult = {
  expenses: Expense[];
}
type TotalExpenseResult = {
  totalExpense: number;
}
type Expense = {
  id: string;
  name: string;
  amount: number;
  description: string;
  userId: string;
};

const ADD_EXPENSE = gql`
  mutation Add($input: AddExpenseInput!) {
  addExpense(input: $input) {
  id
  name
  amount
  userId
  }
  }
  `;

const LIST_EXPENSES = gql`
  query {
  expenses {
  id
  name
  amount
  description
  userId
  }
  }
  `;
  
const DELETE_EXPENSE = gql`
  mutation DeleteExpense($id: ID!) {
  deleteExpense(id: $id)
  }
  `;

const TOTAL_EXPENSES = gql`
query {
totalExpense
}
`;

export default function App() {

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [total, setTotal] = useState(0);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [log, setLog] = useState<any>(null);

  async function handleAdd() {
    const result = await client.mutate({
      mutation: ADD_EXPENSE,
      variables: {
        input: {
          name,
          amount: Number(amount),
          description,
          userId: "u1",
        },
      },
    });
    setLog(result.data);

    await loadExpenses();
    await handleTotalExpenses();
    setName("");
    setAmount("");
    setDescription("");
  }

  async function handleDelete(id: string) {
    await client.mutate({
      mutation: DELETE_EXPENSE,
      variables: { id }
    });
    await loadExpenses();
    await handleTotalExpenses();
  }

  async function handleTotalExpenses() {
    const result = await client.query<TotalExpenseResult>({
      query: TOTAL_EXPENSES,
      fetchPolicy: "network-only",
    });
    setTotal(result.data?.totalExpense ?? 0)
  }

  async function loadExpenses() {
    const result = await client.query<ExpensesResult>({
      query: LIST_EXPENSES,
      fetchPolicy: "network-only",
    });
    setExpenses(result.data!.expenses ?? []);
  }

  useEffect(() => {
    loadExpenses();
    handleTotalExpenses();
  }, [])

  return (
    <div className="p-4">

      <h1>Expense Form</h1>

      <input
        placeholder="name"
        value={name}
        onChange={e => setName(e.target.value)}
      />

      <input
        placeholder="amount"
        type="number"
        value={amount}
        onChange={e => setAmount(e.target.value)}
      />

      <input
        placeholder="description"
        type="string"
        value={description}
        onChange={e => setDescription(e.target.value)}
      />

      <button onClick={handleAdd}>Add Expense</button>

      <h2>Expenses List</h2>
      <ul>
        {expenses.map((e) => (
          <li key={e.id}>
            {e.name} - ₹{e.amount}
            <button onClick={() => handleDelete(e.id)}>Delete</button>
          </li>
        ))}
      </ul>
      <div>Total Expense {total}</div>

      <pre>{log ? JSON.stringify(log, null, 2) : ""}</pre>
    </div>
  );

}