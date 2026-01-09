import { useEffect, useState } from "react";
import client from "./graphql";
import { gql } from "@apollo/client";

type ExpensesResult = {
  expenses: Expense[];
}
type Expense = {
  id: string;
  name: string;
  amount: number;
  description: string;
  userId: string;
};

const ADD_EXPENSE = gql`
  mutation Add($input: AddExpenseInput!){
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


export default function App() {

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

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
    setName("");
    setAmount("");
    setDescription("");
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
          </li>
        ))}
      </ul>

      <pre>{log ? JSON.stringify(log, null, 2) : ""}</pre>
    </div>
  );

}