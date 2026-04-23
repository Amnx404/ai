import { BrandLogo } from "~/components/brand-logo";

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex justify-center">
          <BrandLogo size="md" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
        <p className="mt-2 text-sm text-gray-600">
          A sign-in link has been sent to your email address. Click the link to
          continue.
        </p>
        <p className="mt-4 text-xs text-gray-400">
          Didn&apos;t receive it? Check your spam folder or try again.
        </p>
      </div>
    </div>
  );
}
