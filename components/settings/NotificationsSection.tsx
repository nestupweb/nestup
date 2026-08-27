"use client";

import { Card } from "@/components/settings/Card";
import { SettingToggle } from "@/components/settings/SettingToggle";
import { setNotifyAction } from "@/app/actions/settings";

/** The one e-mail NestUp sends of its own accord. Off unless you ask for it. */
export function NotificationsSection({ notify, address }: { notify: boolean; address: string }) {
  return (
    <Card title="Notifications" hint="NestUp only e-mails you about what you switch on here.">
      <SettingToggle
        label="E-mail me when a new room matches my preferences"
        hint={`Sent the moment a room is posted in one of your cities, inside your budget, and matching you well enough for Swipe. Goes to ${address}.`}
        checked={notify}
        onSave={setNotifyAction}
      />
    </Card>
  );
}
