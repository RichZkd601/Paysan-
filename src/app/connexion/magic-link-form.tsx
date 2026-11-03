"use client";

import { useActionState } from "react";
import { sendMagicLink, type MagicLinkState } from "./actions";

const initialState: MagicLinkState = { status: "idle" };

export function MagicLinkForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

  if (state.status === "sent") {
    return (
      <div role="status" className="rounded-lg border border-green-700 p-4">
        <p className="font-semibold">Vérifiez votre boîte mail.</p>
        <p className="mt-1">
          Nous avons envoyé un lien de connexion à <strong>{state.email}</strong>. Cliquez dessus
          pour vous connecter. Pensez à regarder dans les courriers indésirables.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className="text-base font-medium">
        Votre adresse e-mail
      </label>
      <input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        defaultValue={state.email}
        aria-invalid={state.status === "error"}
        aria-describedby={state.status === "error" ? "email-error" : undefined}
        className="rounded-lg border border-current/30 px-3 py-3 text-base"
      />
      {state.status === "error" && (
        <p id="email-error" role="alert" className="text-red-700 dark:text-red-400">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-green-800 px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Envoi en cours…" : "Recevoir mon lien de connexion"}
      </button>
      <p className="text-sm opacity-70">
        Pas de mot de passe à retenir : vous recevez un lien valable quelques minutes. Si vous
        n&apos;avez pas encore de compte, il est créé automatiquement.
      </p>
    </form>
  );
}
