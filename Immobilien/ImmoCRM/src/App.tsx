import { Button } from "@/components/ui/button"

function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background text-foreground">
      <h1 className="text-3xl font-semibold">ImmoCRM</h1>
      <p className="text-muted-foreground">Setup-Smoke-Test — Schritt 0</p>
      <Button onClick={() => alert("shadcn läuft.")}>Hallo, shadcn!</Button>
    </div>
  )
}

export default App
