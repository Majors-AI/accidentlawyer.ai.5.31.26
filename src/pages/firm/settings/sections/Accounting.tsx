// Accounting department — the shared framework plus the accounting PI workflow.
import DepartmentSection from './DepartmentSection';
import AccountingWorkflow from './accounting/AccountingWorkflow';

export default function Accounting() {
  return (
    <>
      <DepartmentSection deptId="accounting" />
      <AccountingWorkflow />
    </>
  );
}
