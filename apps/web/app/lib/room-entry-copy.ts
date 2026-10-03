/** Question and answers are authored together; one complete bundle lasts for each opening. */
export const roomEntryBundles = [
  {
    question: 'Time to make a little progress?',
    yes: 'Let’s clock it',
    no: 'Coffee first',
    secondary: {
      question: 'Coffee before this little focus session?',
      yes: 'Ready after all',
      no: 'Coffee it is',
    },
  },
  {
    question: 'Got a little work to finish?',
    yes: 'Let’s clear it',
    no: 'Tomorrow, maybe',
    secondary: {
      question: 'Leave that little win for later?',
      yes: 'One win now',
      no: 'Later it is',
    },
  },
  {
    question: 'A little focus, maybe?',
    yes: 'I’m in',
    no: 'Need a breather',
    secondary: {
      question: 'Taking a breather before we begin?',
      yes: 'Let’s begin',
      no: 'Breather first',
    },
  },
  {
    question: 'Ready for your next study stretch?',
    yes: 'Let’s stretch',
    no: 'Time to rest',
    secondary: {
      question: 'Rest before the next study stretch?',
      yes: 'One stretch now',
      no: 'Rest it is',
    },
  },
] as const;
export function nextEntryBundle(previous: number) {
  return (previous + 1) % roomEntryBundles.length;
}
