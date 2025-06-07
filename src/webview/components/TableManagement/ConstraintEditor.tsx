import type React from "react";
import { useCallback, useState } from "react";
import type {
  ColumnDefinition,
  ConstraintDefinition,
} from "../../../shared/types/table-management";

interface ConstraintEditorProps {
  constraints: ConstraintDefinition[];
  columns: ColumnDefinition[];
  tableName: string;
  onChange: (constraints: ConstraintDefinition[]) => void;
}

type ConstraintType = ConstraintDefinition["type"];

export const ConstraintEditor: React.FC<ConstraintEditorProps> = ({
  constraints,
  columns,
  tableName,
  onChange,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newConstraintType, setNewConstraintType] =
    useState<ConstraintType>("UNIQUE");

  const constraintTypes: { value: ConstraintType; label: string }[] = [
    { value: "PRIMARY_KEY", label: "Primary Key" },
    { value: "FOREIGN_KEY", label: "Foreign Key" },
    { value: "UNIQUE", label: "Unique" },
    { value: "CHECK", label: "Check" },
  ];

  const referenceActions = [
    { value: "CASCADE", label: "CASCADE" },
    { value: "SET_NULL", label: "SET NULL" },
    { value: "RESTRICT", label: "RESTRICT" },
    { value: "NO_ACTION", label: "NO ACTION" },
    { value: "SET_DEFAULT", label: "SET DEFAULT" },
  ];

  const addConstraint = useCallback(() => {
    const constraintName = `${newConstraintType.toLowerCase()}_${tableName}_${constraints.length + 1}`;

    const baseConstraint: Partial<ConstraintDefinition> = {
      name: constraintName,
      type: newConstraintType,
    };

    let newConstraint: ConstraintDefinition;

    switch (newConstraintType) {
      case "FOREIGN_KEY":
        newConstraint = {
          ...baseConstraint,
          type: "FOREIGN_KEY",
          columns: [],
          referencedTable: "",
          referencedColumns: [],
          onDelete: "RESTRICT",
          onUpdate: "RESTRICT",
        } as ConstraintDefinition;
        break;

      case "CHECK":
        newConstraint = {
          ...baseConstraint,
          type: "CHECK",
          checkExpression: "",
        } as ConstraintDefinition;
        break;

      default:
        newConstraint = {
          ...baseConstraint,
          type: newConstraintType,
          columns: [],
        } as ConstraintDefinition;
    }

    onChange([...constraints, newConstraint]);
    setEditingIndex(constraints.length);
  }, [constraints, newConstraintType, tableName, onChange]);

  const updateConstraint = useCallback(
    (
      index: number,
      field: keyof ConstraintDefinition,
      value: string | boolean | string[],
    ) => {
      const newConstraints = [...constraints];
      newConstraints[index] = {
        ...newConstraints[index],
        [field]: value,
      };
      onChange(newConstraints);
    },
    [constraints, onChange],
  );

  const removeConstraint = useCallback(
    (index: number) => {
      const newConstraints = constraints.filter((_, i) => i !== index);
      onChange(newConstraints);
      setEditingIndex(null);
    },
    [constraints, onChange],
  );

  const updateConstraintColumns = useCallback(
    (index: number, selectedColumns: string[]) => {
      updateConstraint(index, "columns", selectedColumns);
    },
    [updateConstraint],
  );

  const updateReferencedColumns = useCallback(
    (index: number, selectedColumns: string[]) => {
      updateConstraint(index, "referencedColumns", selectedColumns);
    },
    [updateConstraint],
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Table Constraints</h3>
        <div className="flex space-x-2">
          <select
            value={newConstraintType}
            onChange={(e) =>
              setNewConstraintType(e.target.value as ConstraintType)
            }
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {constraintTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addConstraint}
            disabled={columns.length === 0}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Add Constraint
          </button>
        </div>
      </div>

      {constraints.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>
            No constraints defined. Add columns first, then create constraints.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {constraints.map((constraint, index) => {
            const isEditing = editingIndex === index;

            return (
              <div
                key={`constraint-${constraint.name}-${index}`}
                className={`p-4 border rounded-lg ${isEditing ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {
                          constraintTypes.find(
                            (t) => t.value === constraint.type,
                          )?.label
                        }
                      </span>
                      <input
                        type="text"
                        value={constraint.name}
                        onChange={(e) =>
                          updateConstraint(index, "name", e.target.value)
                        }
                        onFocus={() => setEditingIndex(index)}
                        className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Constraint name"
                      />
                    </div>

                    {/* Constraint-specific fields */}
                    <div className="space-y-3">
                      {(constraint.type === "PRIMARY_KEY" ||
                        constraint.type === "UNIQUE") && (
                        <div>
                          <div className="block text-sm font-medium text-gray-700 mb-1">
                            Columns
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {columns.map((column) => (
                              <label
                                key={column.name}
                                className="flex items-center"
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    constraint.columns?.includes(column.name) ||
                                    false
                                  }
                                  onChange={(e) => {
                                    const currentColumns =
                                      constraint.columns || [];
                                    const newColumns = e.target.checked
                                      ? [...currentColumns, column.name]
                                      : currentColumns.filter(
                                          (c) => c !== column.name,
                                        );
                                    updateConstraintColumns(index, newColumns);
                                  }}
                                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <span className="text-sm text-gray-700">
                                  {column.name}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {constraint.type === "FOREIGN_KEY" && (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="block text-sm font-medium text-gray-700 mb-1">
                                Local Columns
                              </div>
                              <div className="space-y-1">
                                {columns.map((column) => (
                                  <label
                                    key={column.name}
                                    className="flex items-center"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={
                                        constraint.columns?.includes(
                                          column.name,
                                        ) || false
                                      }
                                      onChange={(e) => {
                                        const currentColumns =
                                          constraint.columns || [];
                                        const newColumns = e.target.checked
                                          ? [...currentColumns, column.name]
                                          : currentColumns.filter(
                                              (c) => c !== column.name,
                                            );
                                        updateConstraintColumns(
                                          index,
                                          newColumns,
                                        );
                                      }}
                                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {column.name}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label
                                htmlFor={`ref-table-${index}`}
                                className="block text-sm font-medium text-gray-700 mb-1"
                              >
                                Referenced Table
                              </label>
                              <input
                                id={`ref-table-${index}`}
                                type="text"
                                value={constraint.referencedTable || ""}
                                onChange={(e) =>
                                  updateConstraint(
                                    index,
                                    "referencedTable",
                                    e.target.value,
                                  )
                                }
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="referenced_table"
                              />
                            </div>
                          </div>

                          <div>
                            <label
                              htmlFor={`ref-columns-${index}`}
                              className="block text-sm font-medium text-gray-700 mb-1"
                            >
                              Referenced Columns (comma-separated)
                            </label>
                            <input
                              id={`ref-columns-${index}`}
                              type="text"
                              value={
                                constraint.referencedColumns?.join(", ") || ""
                              }
                              onChange={(e) => {
                                const columns = e.target.value
                                  .split(",")
                                  .map((c) => c.trim())
                                  .filter((c) => c);
                                updateReferencedColumns(index, columns);
                              }}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="id, name"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label
                                htmlFor={`on-delete-${index}`}
                                className="block text-sm font-medium text-gray-700 mb-1"
                              >
                                On Delete
                              </label>
                              <select
                                id={`on-delete-${index}`}
                                value={constraint.onDelete || "RESTRICT"}
                                onChange={(e) =>
                                  updateConstraint(
                                    index,
                                    "onDelete",
                                    e.target.value,
                                  )
                                }
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                {referenceActions.map((action) => (
                                  <option
                                    key={action.value}
                                    value={action.value}
                                  >
                                    {action.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label
                                htmlFor={`on-update-${index}`}
                                className="block text-sm font-medium text-gray-700 mb-1"
                              >
                                On Update
                              </label>
                              <select
                                id={`on-update-${index}`}
                                value={constraint.onUpdate || "RESTRICT"}
                                onChange={(e) =>
                                  updateConstraint(
                                    index,
                                    "onUpdate",
                                    e.target.value,
                                  )
                                }
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                {referenceActions.map((action) => (
                                  <option
                                    key={action.value}
                                    value={action.value}
                                  >
                                    {action.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </>
                      )}

                      {constraint.type === "CHECK" && (
                        <div>
                          <label
                            htmlFor={`check-expr-${index}`}
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Check Expression
                          </label>
                          <textarea
                            id={`check-expr-${index}`}
                            value={constraint.checkExpression || ""}
                            onChange={(e) =>
                              updateConstraint(
                                index,
                                "checkExpression",
                                e.target.value,
                              )
                            }
                            rows={2}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="age >= 0 AND age <= 150"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeConstraint(index)}
                    className="ml-4 text-red-600 hover:text-red-900"
                    title="Remove constraint"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {constraints.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50 rounded-md">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            Constraint Guidelines:
          </h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>
              • Primary keys are automatically created for columns marked as
              primary key
            </li>
            <li>• Foreign keys reference columns in other tables</li>
            <li>
              • Unique constraints ensure column values are unique across rows
            </li>
            <li>• Check constraints validate data using custom expressions</li>
          </ul>
        </div>
      )}
    </div>
  );
};
