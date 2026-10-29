import { authOptions } from '@/server/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SignInOptions } from './sign-in-options';

export default function LoginPage() {
  // v4 providers keep user-supplied settings (custom id/name) in `options`
  const providers = authOptions.providers.map((p) => {
    const resolved = { ...p, ...p.options };
    return { id: resolved.id, name: resolved.name, type: resolved.type };
  });

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your Bookbot account</CardDescription>
      </CardHeader>
      <CardContent>
        <SignInOptions providers={providers} />
      </CardContent>
    </Card>
  );
}
