import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: todos } = await supabase.from('todos').select()

  return (
    <div className="p-8 max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Supabase Query Test</h1>
      {todos && todos.length > 0 ? (
        <ul className="list-disc pl-5 space-y-1">
          {todos.map((todo) => (
            <li key={todo.id} className="text-sm font-medium">{todo.name}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No todo records found in Supabase.</p>
      )}
    </div>
  )
}
